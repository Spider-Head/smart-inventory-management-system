from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from .models import Product, WarehouseStock, InventoryLog
from django.views.decorators.csrf import csrf_exempt
from django.utils.timezone import now
from django.views.decorators.http import require_GET, require_POST
import json
from django.utils.timezone import localtime
from .models import InventoryModel, Shelf, Rack
from django.views.decorators.http import require_POST, require_http_methods
import json
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from django.db import models

# ===========================
# MAIN PAGE VIEW
# ===========================
def organise_products_view(request):
    inventory_models = InventoryModel.objects.all()
    selected_inventory_id = request.GET.get('inventory_id')
    selected_inventory = None
    shelves = []
    unassigned_products = []

    live_product_ids = WarehouseStock.objects.values_list('product__id', flat=True)

    if selected_inventory_id:
        selected_inventory = get_object_or_404(InventoryModel, id=selected_inventory_id)
        shelves = selected_inventory.shelves.prefetch_related('racks__products').order_by('index')

        # Filter rack.products to only products with warehouse stock
        for shelf in shelves:
            for rack in shelf.racks.all():
                rack.filtered_products = rack.products.filter(id__in=live_product_ids)

        unassigned_products = Product.objects.filter(
            rack__isnull=True,
            id__in=live_product_ids
        ).order_by('name')

    context = {
        'inventory_models': inventory_models,
        'selected_inventory': selected_inventory,
        'shelves': shelves,
        'unassigned_products': unassigned_products,
        'active_page': 'organise_products',
    }
    return render(request, 'inventory/organise_products.html', context)



# ===========================
# CREATE INVENTORY MODEL
# ===========================
@require_POST
@csrf_exempt
def create_inventory_model_api(request):
    try:
        data = json.loads(request.body)
        title = data.get('title', '').strip()
        num_shelves = int(data.get('num_shelves', 0))
        racks_per_shelf = int(data.get('racks_per_shelf', 0))
        if not title or num_shelves <= 0 or racks_per_shelf <= 0:
            return JsonResponse({'error': 'Invalid input'}, status=400)
    except (ValueError, json.JSONDecodeError):
        return JsonResponse({'error': 'Invalid JSON or input'}, status=400)

    inventory_model = InventoryModel.objects.create(title=title)
    for shelf_idx in range(1, num_shelves + 1):
        shelf = Shelf.objects.create(inventory=inventory_model, index=shelf_idx, label=f'Shelf {shelf_idx}')
        for rack_idx in range(1, racks_per_shelf + 1):
            Rack.objects.create(shelf=shelf, index=rack_idx, label=f'Rack {rack_idx}')
    return JsonResponse({'success': True, 'inventory_model_id': inventory_model.id})


# ===========================
# UPDATE PRODUCT RACK ASSIGNMENT
# ===========================
@require_POST
@csrf_exempt
def update_product_rack_api(request):
    try:
        data = json.loads(request.body)
        product_id = int(data.get('product_id'))
        rack_id = data.get('rack_id')
        product = Product.objects.get(id=product_id)
        if rack_id is None:
            product.rack = None
        else:
            rack = Rack.objects.get(id=int(rack_id))
            product.rack = rack
        product.save()
        return JsonResponse({'success': True})
    except (Product.DoesNotExist, Rack.DoesNotExist, ValueError, json.JSONDecodeError):
        return JsonResponse({'error': 'Invalid product or rack'}, status=400)


# ===========================
# DELETE RACK
# ===========================
@require_http_methods(["DELETE"])
@csrf_exempt
def delete_rack_api(request, rack_id):
    try:
        rack = Rack.objects.get(id=rack_id)
        rack.products.update(rack=None)
        rack.delete()
        return JsonResponse({'success': True})
    except Rack.DoesNotExist:
        return JsonResponse({'error': 'Rack not found'}, status=404)


# ===========================
# DELETE SHELF
# ===========================
@require_http_methods(["DELETE"])
@csrf_exempt
def delete_shelf_api(request, shelf_id):
    try:
        shelf = Shelf.objects.get(id=shelf_id)
        for rack in shelf.racks.all():
            rack.products.update(rack=None)
        shelf.racks.all().delete()
        shelf.delete()
        return JsonResponse({'success': True})
    except Shelf.DoesNotExist:
        return JsonResponse({'error': 'Shelf not found'}, status=404)


# ===========================
# DELETE INVENTORY MODEL
# ===========================
@require_http_methods(["DELETE"])
@csrf_exempt
def delete_inventory_model_api(request, inventory_id):
    try:
        inventory = InventoryModel.objects.get(id=inventory_id)
        for shelf in inventory.shelves.all():
            for rack in shelf.racks.all():
                rack.products.update(rack=None)
            shelf.racks.all().delete()
        inventory.shelves.all().delete()
        inventory.delete()
        return JsonResponse({'success': True})
    except InventoryModel.DoesNotExist:
        return JsonResponse({'error': 'Inventory model not found'}, status=404)


# ===========================
# ADD RACK
# ===========================
@require_POST
@csrf_exempt
def add_rack_api(request):
    try:
        data = json.loads(request.body)
        shelf_id = int(data.get('shelf_id'))
        shelf = Shelf.objects.get(id=shelf_id)
        max_index = shelf.racks.aggregate(max_idx=models.Max('index'))['max_idx'] or 0
        new_rack = Rack.objects.create(shelf=shelf, index=max_index + 1, label=f"Rack {max_index + 1}")
        return JsonResponse({'success': True, 'new_rack': {'id': new_rack.id, 'label': new_rack.label}})
    except (Shelf.DoesNotExist, ValueError, json.JSONDecodeError):
        return JsonResponse({'error': 'Invalid shelf id or request'}, status=400)


# ===========================
# RENAME SHELF
# ===========================
@require_POST
@csrf_exempt
def rename_shelf_api(request):
    try:
        data = json.loads(request.body)
        shelf_id = int(data.get('shelf_id'))
        label = data.get('label', '').strip()
        shelf = Shelf.objects.get(id=shelf_id)
        shelf.label = label
        shelf.save()
        return JsonResponse({'success': True})
    except Shelf.DoesNotExist:
        return JsonResponse({'error': 'Shelf not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


# ===========================
# RENAME RACK
# ===========================
@require_POST
@csrf_exempt
def rename_rack_api(request):
    try:
        data = json.loads(request.body)
        rack_id = int(data.get('rack_id'))
        label = data.get('label', '').strip()
        rack = Rack.objects.get(id=rack_id)
        rack.label = label
        rack.save()
        return JsonResponse({'success': True})
    except Rack.DoesNotExist:
        return JsonResponse({'error': 'Rack not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

# 👉 Renders the scanner page
def home_view(request):
    return render(request, 'index.html', {'active_page': 'scan-page'})

def landing_page(request):
    return render(request, 'landing.html', {'active_page': 'home'})


# 👉 Fetch product details by PID (triggered by QR scan)
@csrf_exempt
def get_product_by_pid(request, pid):
    try:
        product = Product.objects.get(pid=pid)
        stock, created = WarehouseStock.objects.get_or_create(product=product)

        qty_param = request.GET.get("qty")
        preload_only = request.GET.get("preload", "false").lower() == "true"
        qty = int(qty_param) if qty_param and qty_param.isdigit() else 1

        is_duplicate = request.GET.get("dup", "false").lower() == "true"

        if not preload_only:
            if not is_duplicate:
                stock.quantity += qty
                stock.save()
                # If it's the first time the product is being added
                if stock.quantity == qty:
                    InventoryLog.objects.create(product=product, action='add', quantity=qty, timestamp=now())

        latest_add_log = (
            InventoryLog.objects
            .filter(product=product, action='add')
            .order_by('-timestamp')
            .first()
        )
        if latest_add_log:
            added_date = localtime(latest_add_log.timestamp).strftime('%Y-%m-%d %H:%M')
        else:
            added_date = ''

        # 🆕 Always return remaining quantity
        remaining_quantity = stock.quantity

        data = {
            'pid': product.pid,
            'name': product.name,
            'category': product.category.name,
            'added_date': added_date,
            'expiry_date': product.expiry_date.strftime('%Y-%m-%d'),
            'price': str(product.price),
            'quantity': remaining_quantity  # ✅ send current stock too
        }
        return JsonResponse(data)

    except Product.DoesNotExist:
        return JsonResponse({'error': 'Product not found'}, status=404)




# 👉 Handles removal from warehouse when user confirms "Yes"
import uuid
import json
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from .models import Product, WarehouseStock, InventoryLog, StockMovement
from django.utils.timezone import now

import json
import uuid
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.utils.timezone import now, localtime
from .models import Product, WarehouseStock, InventoryLog, StockMovement

@csrf_exempt
def remove_product(request, pid):
    if request.method == "POST":
        try:
            product = Product.objects.get(pid=pid)
            stock = WarehouseStock.objects.get(product=product)

            # Read details from request JSON
            try:
                body = json.loads(request.body.decode('utf-8'))
                remove_qty = int(body.get('quantity', 1))
                purchaser = body.get('purchaser', '')
                contact = body.get('contact', '')
                email = body.get('email', '')
                payment_status = body.get('payment_status', 'paid')
                amount = float(body.get('amount', 0))
            except Exception:
                remove_qty = 1
                purchaser = ''
                contact = ''
                email = ''
                payment_status = 'paid'
                amount = 0

            # Validate quantity
            if remove_qty <= 0:
                return JsonResponse({'error': 'Invalid quantity'}, status=400)
            if stock.quantity <= 0:
                return JsonResponse({'error': 'No stock to remove'}, status=400)
            if remove_qty > stock.quantity:
                return JsonResponse({'error': 'Not enough stock to remove'}, status=400)

            # Update stock
            stock.quantity -= remove_qty
            if stock.quantity == 0:
                stock.delete()
                remaining_quantity = 0
            else:
                stock.save()
                remaining_quantity = stock.quantity

            # Inventory log (for history)
            InventoryLog.objects.create(
                product=product,
                action='remove',
                quantity=remove_qty,
                timestamp=now()
            )

            # Create StockMovement with amount
            order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
            StockMovement.objects.create(
                order_id=order_id,
                product=product,
                quantity=remove_qty,
                action='remove',
                purchaser_name=purchaser,
                contact_no=contact,
                email=email,
                amount=amount,
                payment_status=payment_status
            )

            return JsonResponse({
                'quantity': remaining_quantity,
                'order_id': order_id,
                'payment_status': payment_status
            }, status=200)

        except (Product.DoesNotExist, WarehouseStock.DoesNotExist):
            return JsonResponse({'error': 'Product or stock not found'}, status=404)

    return JsonResponse({'error': 'Invalid request method'}, status=405)

from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.http import JsonResponse
import json
from django.utils.timezone import now
from .models import Product, WarehouseStock, InventoryLog, StockMovement

@csrf_exempt
@require_POST
def remove_multiple_products(request):
    try:
        data = json.loads(request.body)
        purchaser_info = data.get('purchaser', {})
        products = data.get('products', [])

        if not products:
            return JsonResponse({'error': "No products provided."}, status=400)

        # Track overall successes and failures
        errors = []
        for prod in products:
            pid = prod.get('pid')
            qty = int(prod.get('quantity', 0))
            if qty <= 0:
                continue

            try:
                product = Product.objects.get(pid=pid)
                stock = WarehouseStock.objects.get(product=product)

                if stock.quantity < qty:
                    errors.append(f"Insufficient stock for {product.name}.")
                    continue

                stock.quantity -= qty
                if stock.quantity == 0:
                    stock.delete()
                else:
                    stock.save()

                InventoryLog.objects.create(product=product, action='remove', quantity=qty, timestamp=now())

                StockMovement.objects.create(
                    order_id=str(uuid.uuid4()),
                    product=product,
                    quantity=qty,
                    action='remove',
                    purchaser_name=purchaser_info.get('name', ''),
                    contact_no=purchaser_info.get('contact', ''),
                    email=purchaser_info.get('email', ''),
                    amount=prod.get('price', 0) * qty,
                    payment_status='paid',
                    timestamp=now(),
                )

            except Product.DoesNotExist:
                errors.append(f"Product with PID {pid} does not exist.")
            except WarehouseStock.DoesNotExist:
                errors.append(f"Stock for product {pid} does not exist.")

        if errors:
            return JsonResponse({'success': False, 'errors': errors})
        else:
            return JsonResponse({'success': True})

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON.'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# New API endpoint for stock movements
def stock_movements_list(request):
    movements = StockMovement.objects.select_related('product').order_by('-timestamp')
    data = []
    for move in movements:
        data.append({
            'order_id': move.order_id,
            'timestamp': localtime(move.timestamp).strftime('%Y-%m-%d %H:%M'),
            'product': move.product.name,
            'quantity': move.quantity,
            'action': move.get_action_display(),
            'purchaser': move.purchaser_name or '-',
            'contact': move.contact_no or '-',
            'amount': str(move.amount),
            'payment_status': move.get_payment_status_display()
        })
    return JsonResponse(data, safe=False)


from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import json
from .models import StockMovement

@csrf_exempt
@require_POST
def update_payment_status_api(request, order_id):
    try:
        data = json.loads(request.body)
        new_status = data.get('payment_status', '').lower()
        if new_status not in ['paid', 'pending', 'failed']:
            return JsonResponse({'error': 'Invalid payment status'}, status=400)

        movement = StockMovement.objects.get(order_id=order_id)
        movement.payment_status = new_status
        movement.save()

        return JsonResponse({'success': True, 'payment_status': new_status})

    except StockMovement.DoesNotExist:
        return JsonResponse({'error': 'Stock movement record not found'}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)





from django.views.decorators.http import require_http_methods
@require_http_methods(["DELETE"])
@csrf_exempt
def delete_stock_movement(request, order_id):
    try:
        movement = StockMovement.objects.get(order_id=order_id)
        movement.delete()
        return JsonResponse({'success': True, 'order_id': order_id})
    except StockMovement.DoesNotExist:
        return JsonResponse({'error': 'Record not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def stock_movements_page_view(request):
    return render(request, 'inventory/stock_movements.html', {'active_page': 'stock_movements_page'})

# 👉 Optional route (used if you want to keep /inventory/scan/)
def scan_page(request):
    return render(request, 'inventory/index.html', {'active_page': 'scan-page'})




@require_GET
def get_all_warehouse_stock(request):
    stocks = WarehouseStock.objects.select_related('product').all()
    data = []
    for stock in stocks:
        latest_add_log = (
            InventoryLog.objects
            .filter(product=stock.product, action='add')
            .order_by('-timestamp')
            .first()
        )
        if latest_add_log:
            added_dt = localtime(latest_add_log.timestamp)
            added_date = added_dt.strftime('%Y-%m-%d %H:%M')
        else:
            added_dt = None
            added_date = ''

        data.append({
            'pid': stock.product.pid,
            'name': stock.product.name,
            'category': stock.product.category.name,
            'added_date': added_date,
            'expiry_date': stock.product.expiry_date.strftime('%Y-%m-%d'),
            'price': str(stock.product.price),
            'quantity': stock.quantity,
            '__added_dt': added_dt
        })

    data.sort(key=lambda x: x['__added_dt'] or '', reverse=True)

    for item in data:
        item.pop('__added_dt', None)
    return JsonResponse(data, safe=False)

from .utils import (
    get_about_to_expire_products,
    get_low_or_zero_stock,
    get_least_stock_category,
    predict_stockouts,
    get_consumption_chart_json,  # <-- add this to imports
    get_expired_products
)


def dashboard_view(request):
    consumption_data = get_consumption_chart_json()
    consumption_data_json = json.dumps(consumption_data) if consumption_data else None

    context = {
        "about_to_expire": get_about_to_expire_products(),
        "low_stock": get_low_or_zero_stock(),
        "least_category": get_least_stock_category(),
        "predicted_outs": predict_stockouts(),
        "chart_data_json": consumption_data_json,  # <-- pass this instead of base64
        "expired_products": get_expired_products(),
        "active_page": "dashboard"
    }
    return render(request, "inventory/dashboard.html", context)


from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.core.mail import send_mail, send_mass_mail
from django.http import JsonResponse
import json


@csrf_exempt  # if you want to exempt CSRF (not recommended), else ensure ajax has CSRF token
@require_POST
def reorder_product(request):
    try:
        data = json.loads(request.body)
        product_name = data.get('product')
        quantity = int(data.get('quantity', 1))
        price = data.get('price', '')
        supplier_name = data.get('supplier')
        supplier_email = data.get('email')


        if not all([product_name, quantity, price, supplier_name, supplier_email]):
            return JsonResponse({'error': 'Missing required fields'}, status=400)


        # Prepare email content
        subject = f"Reorder Request: {product_name}"
        message = f"""
Dear {supplier_name},


We would like to place an order for the following product:


Product Name: {product_name}
Quantity: {quantity}
Total Price: {price}


Please confirm availability and expected delivery date.


Thank you.


--
Automated Inventory Notification
"""


        from_email = 'no-reply@example.com'  # Change to your valid sending email / site email
       
        # Send email
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=[supplier_email],
            fail_silently=False,
        )


        return JsonResponse({'success': True})


    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON payload'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
    


from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from .models import SensorData
import json

@csrf_exempt
def receive_iot_data(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body.decode('utf-8'))
            temperature = data.get('temperature')
            humidity = data.get('humidity')
            gas_level = data.get('gas_level')
            leak = data.get('leak', False)

            SensorData.objects.create(
                temperature=temperature,
                humidity=humidity,
                gas_level=gas_level,
                liquid_leak_detected=leak
            )

            return JsonResponse({'status': 'success'}, status=200)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
    else:
        return JsonResponse({'error': 'Invalid request method'}, status=405)


from django.shortcuts import render

def inventory_monitoring_page(request):
    return render(request, 'inventory/monitoring.html', {'active_page': 'monitoring'})


from django.http import JsonResponse

def get_latest_sensor_data(request):
    latest = SensorData.objects.order_by('-timestamp').first()
    if not latest:
        return JsonResponse({'error': 'No data yet'}, status=404)
    return JsonResponse({
        'temperature': latest.temperature,
        'humidity': latest.humidity,
        'gas_level': latest.gas_level,
        'liquid_leak_detected': latest.liquid_leak_detected,
        'timestamp': latest.timestamp
    })
