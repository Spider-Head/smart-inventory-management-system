import matplotlib
matplotlib.use('Agg')
from datetime import timedelta
from django.utils.timezone import now
from .models import Product, WarehouseStock, InventoryLog
from django.db.models import Sum, Count
import pandas as pd
import matplotlib.pyplot as plt
from io import BytesIO
import base64
from collections import defaultdict
import json

def get_about_to_expire_products(days=7):
    today = now().date()
    soon = today + timedelta(days=days)
    return Product.objects.filter(expiry_date__range=(today, soon))

def get_expired_products():
    today = now().date()
    return Product.objects.filter(expiry_date__lt=today)

def get_low_or_zero_stock(threshold=10):
    name_totals = (
        WarehouseStock.objects
        .values('product__name')
        .annotate(total_qty=Sum('quantity'))
    )
    low_stock_names = {item['product__name'] for item in name_totals if item['total_qty'] <= threshold}
    if not low_stock_names:
        return []

    product_details = (
        WarehouseStock.objects
        .filter(product__name__in=low_stock_names)
        .values('product__pid', 'product__name')
        .annotate(pid_quantity=Sum('quantity'))
        .order_by('product__name', 'product__pid')
    )

    grouped = defaultdict(lambda: {'total_quantity': 0, 'pids': []})
    total_quantities_map = {item['product__name']: item['total_qty'] for item in name_totals if item['product__name'] in low_stock_names}

    for prod in product_details:
        name = prod['product__name']
        pid = prod['product__pid']
        qty = prod['pid_quantity']
        grouped[name]['total_quantity'] = total_quantities_map[name]
        grouped[name]['pids'].append({'pid': pid, 'quantity': qty})

    result = []
    for name, data in grouped.items():
        result.append({
            'name': name,
            'total_quantity': data['total_quantity'],
            'pids': data['pids'],
        })
    return result

def get_least_stock_category():
    qs = WarehouseStock.objects.values(
        'product__category__name'
    ).annotate(
        total=Sum('quantity'),
        product_count=Count('product')
    ).order_by('total')
    return qs[0] if qs else None

def predict_stockouts():
    # Step 1: Get all removal logs with related product info
    logs = InventoryLog.objects.filter(action="remove").values(
        "timestamp",
        "product__pid",
        "quantity",
        "product__name",
        "product__category__name"
    )
    df = pd.DataFrame.from_records(logs)
    if df.empty:
        return []

    # Step 2: Prepare dataframe for grouping
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["date"] = df["timestamp"].dt.date
    
    # Group quantity removed per PID and date
    grouped = df.groupby(["product__pid", "date"])["quantity"].sum().reset_index()
    pids = grouped["product__pid"].unique()

    # Step 3: Get stocks for all PIDs from logs that have appropriate WarehouseStock entries
    stocks_qs = WarehouseStock.objects.filter(product__pid__in=pids).select_related('product__category')
    stock_map = {ws.product.pid: {'stock': ws.quantity, 'product': ws.product} for ws in stocks_qs}

    # Step 4: Handle products with logs but no WarehouseStock (treat stock as 0)
    missing_pids = [pid for pid in pids if pid not in stock_map]
    if missing_pids:
        # Fetch Product objects for missing PIDs
        products_missing_stock = Product.objects.filter(pid__in=missing_pids).select_related('category')
        for prod in products_missing_stock:
            stock_map[prod.pid] = {'stock': 0, 'product': prod}

    # Step 5: Calculate daily average consumption per PID
    pid_daily_avg = {}
    for pid in pids:
        series = grouped[grouped["product__pid"] == pid].set_index("date")["quantity"]
        daily_avg = series.rolling(3).mean().iloc[-1] if len(series) >= 3 else series.mean()
        pid_daily_avg[pid] = daily_avg if daily_avg else 0

    # Step 6: Aggregate by (Category name, Product name)
    aggregated = {}
    for pid, daily_avg in pid_daily_avg.items():
        if pid not in stock_map:
            # Defensive: skip if no stock or product info at all
            continue
        stock = stock_map[pid]['stock']
        product = stock_map[pid]['product']
        cat_name = product.category.name
        prod_name = product.name

        key = (cat_name, prod_name)
        if key not in aggregated:
            aggregated[key] = {
                "category": cat_name,
                "name": prod_name,
                "total_stock": 0,
                "total_daily_avg": 0,
                "count_pids": 0,
                "price": product.price,  # Assumes price consistent or take first
                "supplier_name": product.category.supplier_name,
                "supplier_email": product.category.supplier_email,
                "pids": []
            }

        aggregated[key]["total_stock"] += stock
        aggregated[key]["total_daily_avg"] += daily_avg
        aggregated[key]["count_pids"] += 1
        aggregated[key]["pids"].append({
            "pid": pid,
            "stock": stock,
            "daily_avg": round(daily_avg, 2)
        })

    # Step 7: Build final result list with insights, including zero-stock ones
    result = []
    for key, val in aggregated.items():
        total_stock = val["total_stock"]
        daily_avg = val["total_daily_avg"]
        days_left = int(total_stock / daily_avg) if daily_avg else None

        # Calculate urgency score: out of stock highest urgency
        urgency_score = 0
        if days_left is not None:
            if total_stock == 0:
                urgency_score = 3  # Highest urgency if no stock
            elif days_left == 0:
                urgency_score = 3
            elif days_left <= 3:
                urgency_score = 2
            elif days_left <= 7:
                urgency_score = 1

        months_left = round(days_left / 30, 2) if days_left else None

        # Insight message for user-friendly display
        if total_stock == 0:
            insight = "❌ Out of stock – Urgent reorder needed!"
        elif days_left == 0:
            insight = "❌ Stock depleted – Urgent reorder needed!"
        elif daily_avg == 0:
            insight = "ℹ️ No recent sales – Review demand."
        elif days_left <= 3:
            insight = f"⚠️ Low stock – reorder within {days_left} days."
        elif days_left <= 7:
            insight = f"⏳ Moderate stock – consider reorder soon (in {days_left} days)."
        else:
            insight = f"✅ Stock sufficient for about {days_left} days."

        result.append({
            "category": val["category"],
            "name": val["name"],
            "total_stock": total_stock,
            "daily_avg": round(daily_avg, 2),
            "days_left": days_left,
            "price": val["price"],
            "supplier_name": val["supplier_name"],
            "supplier_email": val["supplier_email"],
            "urgency_score": urgency_score,
            "months_left": months_left,
            "insight": insight,
            "pids": val["pids"]
        })

    # Step 8: Sort results by urgency (high to low) and days left ascending
    result.sort(key=lambda x: (-x["urgency_score"], (x["days_left"] if x["days_left"] is not None else 999)))

    return result


def get_consumption_chart_json():
    logs = InventoryLog.objects.filter(action='remove').select_related('product__category')
    if not logs.exists():
        return None

    data = [{
        'timestamp': log.timestamp.date(),
        'category': log.product.category.name,
        'quantity': log.quantity
    } for log in logs]

    df = pd.DataFrame(data)
    if df.empty:
        return None

    def aggregate(scope):
        if scope == 'daily':
            df['time_key'] = df['timestamp']
        elif scope == 'weekly':
            df['time_key'] = pd.to_datetime(df['timestamp']).dt.to_period('W').dt.start_time.dt.date
        elif scope == 'monthly':
            df['time_key'] = pd.to_datetime(df['timestamp']).dt.to_period('M').dt.to_timestamp().dt.date
        else:
            raise ValueError("Unknown scope: %s" % scope)
        grouped = df.groupby(['time_key', 'category'])['quantity'].sum().reset_index()
        pivot = grouped.pivot(index='time_key', columns='category', values='quantity').fillna(0)
        categories = list(pivot.columns)
        dates = [str(d) for d in pivot.index]
        quantities = pivot.to_dict(orient='list')
        return {
            'categories': categories,
            'dates': dates,
            'quantities': quantities
        }

    return {
        'daily': aggregate('daily'),
        'weekly': aggregate('weekly'),
        'monthly': aggregate('monthly')
    }
