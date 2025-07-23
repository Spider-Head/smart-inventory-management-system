from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from .models import Product, WarehouseStock, InventoryLog
from django.views.decorators.csrf import csrf_exempt

# 👉 Renders the scanner page
def home_view(request):
    return render(request, 'inventory/index.html', {'active_page': 'home'})

# 👉 Fetch product details by PID (triggered by QR scan)
@csrf_exempt
def get_product_by_pid(request, pid):
    try:
        product = Product.objects.get(pid=pid)
        stock, _ = WarehouseStock.objects.get_or_create(product=product)

        # ✅ Check if duplicate scan
        is_duplicate = request.GET.get("dup", "false").lower() == "true"

        if not is_duplicate:
            stock.quantity += 1
            stock.save()
            InventoryLog.objects.create(product=product, action='add', quantity=1)

        data = {
            'pid': product.pid,
            'name': product.name,
            'category': product.category.name,
            'added_date': product.added_date.strftime('%Y-%m-%d'),
            'expiry_date': product.expiry_date.strftime('%Y-%m-%d'),
            "price": str(product.price),
        }
        return JsonResponse(data)

    except Product.DoesNotExist:
        return JsonResponse({'error': 'Product not found'}, status=404)

# 👉 Handles removal from warehouse when user confirms "Yes"
@csrf_exempt
def remove_product(request, pid):
    if request.method == "POST":
        try:
            product = Product.objects.get(pid=pid)
            stock = WarehouseStock.objects.get(product=product)

            if stock.quantity > 0:
                stock.quantity -= 1

                # Save or delete based on updated quantity
                if stock.quantity == 0:
                    stock.delete()
                    remaining_quantity = 0
                else:
                    stock.save()
                    remaining_quantity = stock.quantity

                # Log the removal
                InventoryLog.objects.create(product=product, action='remove', quantity=1)

                # ✅ Respond with updated quantity
                return JsonResponse({'quantity': remaining_quantity}, status=200)

            return JsonResponse({'error': 'No stock to remove'}, status=400)

        except (Product.DoesNotExist, WarehouseStock.DoesNotExist):
            return JsonResponse({'error': 'Product or stock not found'}, status=404)

    return JsonResponse({'error': 'Invalid request method'}, status=405)

# 👉 Optional route (used if you want to keep /inventory/scan/)
def scan_page(request):
    return render(request, 'inventory/index.html')


from django.views.decorators.http import require_GET

@require_GET
def get_all_warehouse_stock(request):
    stocks = WarehouseStock.objects.select_related('product').all()
    data = [
        {
            'pid': stock.product.pid,
            'name': stock.product.name,
            'category': stock.product.category.name,
            'added_date': stock.product.added_date.strftime('%Y-%m-%d'),
            'expiry_date': stock.product.expiry_date.strftime('%Y-%m-%d'),
            'price': str(stock.product.price), 
        }
        for stock in stocks
    ]
    return JsonResponse(data, safe=False)



from .utils import (
    get_about_to_expire_products,
    get_low_or_zero_stock,
    get_least_stock_category,
    predict_stockouts,
    get_consumption_chart_base64,
    get_expired_products  # ✅ Add this
)

def dashboard_view(request):
    context = {
        "about_to_expire": get_about_to_expire_products(),
        "low_stock": get_low_or_zero_stock(),
        "least_category": get_least_stock_category(),
        "predicted_outs": predict_stockouts(),
        "chart_base64": get_consumption_chart_base64(),
        "expired_products": get_expired_products(),
        "active_page": "dashboard"   # ✅ Add this line
    }
    return render(request, "inventory/dashboard.html", context)

