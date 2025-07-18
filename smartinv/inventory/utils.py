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


def get_low_or_zero_stock(threshold=10):
    from django.db.models import Sum

    # Group by product name across PIDs
    stock_data = (
        WarehouseStock.objects
        .values('product__name')  # ✅ group by name
        .annotate(total_qty=Sum('quantity'))
        .order_by('total_qty')
    )

    low_or_zero = []

    for item in stock_data:
        if item['total_qty'] <= threshold:
            low_or_zero.append({
                'name': item['product__name'],
                'total_quantity': item['total_qty']
            })

    return low_or_zero

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
            days_left = int(stock.quantity / daily_avg) if daily_avg else None
            if days_left is not None and days_left < 7:
                result.append({
                    "pid": pid,
                    "stock": stock.quantity,
                    "daily_avg": round(daily_avg, 2),
                    "days_left": days_left
                })
        except WarehouseStock.DoesNotExist:
            continue

    return result

def get_consumption_chart_base64():

    logs = InventoryLog.objects.filter(action='remove').select_related('product__category')

    if not logs.exists():
        return None

    # Step 1: Prepare data
    data = [{
        'timestamp': log.timestamp.date(),
        'category': log.product.category.name,
        'quantity': log.quantity
    } for log in logs]

    df = pd.DataFrame(data)

    # Step 2: Group by date and category
    grouped = df.groupby(['timestamp', 'category'])['quantity'].sum().reset_index()

    # Step 3: Pivot - Dates as index, Categories as columns
    pivot = grouped.pivot(index='timestamp', columns='category', values='quantity').fillna(0)

    # Step 4: Plot grouped vertical bars
    plt.figure(figsize=(7, 5))
    bar_width = 0.15
    dates = pivot.index.astype(str)  # Convert date to string for x-axis labels
    categories = pivot.columns
    x = range(len(dates))

    for idx, category in enumerate(categories):
        plt.bar(
            [i + idx * bar_width for i in x],
            pivot[category],
            width=bar_width,
            label=category
        )

    plt.xlabel('Date')
    plt.ylabel('Quantity Removed')
    plt.title('Daily Consumption by Category')
    plt.xticks([i + bar_width * (len(categories) / 2) for i in x], dates, rotation=45)
    plt.legend(title="Category")
    plt.tight_layout()

    # Step 5: Convert to base64
    buf = BytesIO()
    plt.savefig(buf, format='png')
    plt.close()
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')

