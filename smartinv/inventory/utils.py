import matplotlib
matplotlib.use('Agg')
from datetime import timedelta
from django.utils.timezone import now
from .models import Product, WarehouseStock, InventoryLog
from django.db.models import Sum
import pandas as pd
import matplotlib.pyplot as plt
from io import BytesIO
import base64


def get_about_to_expire_products(days=7):
    today = now().date()
    soon = today + timedelta(days=days)
    return Product.objects.filter(expiry_date__range=(today, soon))

def get_expired_products():
    today = now().date()
    return Product.objects.filter(expiry_date__lt=today)

from collections import defaultdict
from django.db.models import Sum

def get_low_or_zero_stock(threshold=10):
    # 1. Aggregate total_quantity by product name
    from collections import defaultdict
    from django.db.models import Sum

    # Aggregate total quantity per product name
    name_totals = (
        WarehouseStock.objects
        .values('product__name')
        .annotate(total_qty=Sum('quantity'))
    )
    # Pick product names with total quantity less or equal threshold
    low_stock_names = {item['product__name'] for item in name_totals if item['total_qty'] <= threshold}
    if not low_stock_names:
        return []

    # 2. Get product details grouped by those low stock product names with PIDs and their quantities
    product_details = (
        WarehouseStock.objects
        .filter(product__name__in=low_stock_names)
        .values('product__pid', 'product__name')
        .annotate(pid_quantity=Sum('quantity'))
        .order_by('product__name', 'product__pid')
    )

    # 3. Group products by name, prepare final data structure
    grouped = defaultdict(lambda: {'total_quantity': 0, 'pids': []})
    # Map total quantities per name for reference
    total_quantities_map = {item['product__name']: item['total_qty'] for item in name_totals if item['product__name'] in low_stock_names}

    for prod in product_details:
        name = prod['product__name']
        pid = prod['product__pid']
        qty = prod['pid_quantity']
        grouped[name]['total_quantity'] = total_quantities_map[name]
        grouped[name]['pids'].append({'pid': pid, 'quantity': qty})

    # 4. Convert grouped dict to list for template context
    result = []
    for name, data in grouped.items():
        result.append({
            'name': name,
            'total_quantity': data['total_quantity'],
            'pids': data['pids'],
        })

    return result


from django.db.models import Sum, Count

def get_least_stock_category():
    qs = WarehouseStock.objects.values(
        'product__category__name'
    ).annotate(
        total=Sum('quantity'),
        product_count=Count('product')
    ).order_by('total')

    return qs[0] if qs else None


def predict_stockouts():
    logs = InventoryLog.objects.filter(action="remove").values("timestamp", "product__pid", "quantity")
    df = pd.DataFrame.from_records(logs)

    if df.empty:
        return []

    # ✅ Convert timestamp to datetime and extract date in a new column
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["date"] = df["timestamp"].dt.date

    # ✅ Group by PID and Date, sum quantity
    grouped = df.groupby(["product__pid", "date"])["quantity"].sum().reset_index()

    result = []

    for pid in grouped["product__pid"].unique():
        series = grouped[grouped["product__pid"] == pid].set_index("date")["quantity"]

        # Use rolling mean or average demand
        daily_avg = series.rolling(3).mean().iloc[-1] if len(series) >= 3 else series.mean()

        try:
            stock = WarehouseStock.objects.get(product__pid=pid)
            product = stock.product
            days_left = int(stock.quantity / daily_avg) if daily_avg else None
            if days_left is not None and days_left < 7:
                result.append({
                    "pid": pid,
                    "name": product.name,
                    "stock": stock.quantity,
                    "daily_avg": round(daily_avg, 2),
                    "days_left": days_left,
                    "price": product.price,  # <- add price
                    "supplier_name": product.supplier_name,   # <- add supplier name
                    "supplier_email": product.supplier_email, # <- add email
                    "default_qty": 1   # (optional) default reorder qty
                })

        except WarehouseStock.DoesNotExist:
            continue

    return result

import json

def get_consumption_chart_json():
    logs = InventoryLog.objects.filter(action='remove').select_related('product__category')
    if not logs.exists():
        return None

    data = [{
        'timestamp': log.timestamp.date().isoformat(),
        'category': log.product.category.name,
        'quantity': log.quantity
    } for log in logs]

    import pandas as pd
    df = pd.DataFrame(data)
    if df.empty:
        return None

    # Pivot for categories over days
    grouped = df.groupby(['timestamp', 'category'])['quantity'].sum().reset_index()
    pivot = grouped.pivot(index='timestamp', columns='category', values='quantity').fillna(0)
    categories = list(pivot.columns)
    dates = list(pivot.index)
    quantities = pivot.to_dict(orient='list')

    # This dict is safe for JSON serialization
    return {
        'categories': categories,
        'dates': dates,
        'quantities': quantities  # {'cat1': [q1, q2, ...], ...}
    }
