from django.urls import path
from . import views
from django.views.generic import TemplateView
from django.shortcuts import render

urlpatterns = [
    path('scan/', views.scan_page, name='scan-page'),
    path('product/<str:pid>/', views.get_product_by_pid, name='get-product'),
    path('remove/<str:pid>/', views.remove_product, name='remove-product'),
    path('warehouse/', views.get_all_warehouse_stock, name='get-all-warehouse-stock'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('landing/', TemplateView.as_view(template_name='landing.html'), name='landing'),
    path('reorder/', views.reorder_product, name='reorder_product'),

    # --- New for shelf/rack organizer ---
    path('organise-products/', views.organise_products_view, name='organise_products'),
    path('api/create-inventory-model/', views.create_inventory_model_api, name='create_inventory_model_api'),
    path('api/update-product-rack/', views.update_product_rack_api, name='update_product_rack_api'),

    # New API endpoints for reversible operations
    path('api/delete-rack/<int:rack_id>/', views.delete_rack_api, name='delete_rack_api'),
    path('api/delete-shelf/<int:shelf_id>/', views.delete_shelf_api, name='delete_shelf_api'),
    path('api/delete-inventory-model/<int:inventory_id>/', views.delete_inventory_model_api, name='delete_inventory_model_api'),
    path('api/add-rack/', views.add_rack_api, name='add_rack_api'),

    # --- Add these for renaming shelf/rack ---
    path('api/rename-shelf/', views.rename_shelf_api, name='rename_shelf_api'),
    path('api/rename-rack/', views.rename_rack_api, name='rename_rack_api'),

    path('remove_multiple/', views.remove_multiple_products, name='remove_multiple'),

    # Stock movements pages and APIs
    path('stock_movements/', views.stock_movements_list, name='stock_movements_list'),
    path('stock_movements_page/', views.stock_movements_page_view, name='stock_movements_page'),
    path('stock_movements/delete/<str:order_id>/', views.delete_stock_movement, name='delete_stock_movement'),

    # API endpoint to update payment status of a stock movement
    path('api/update-payment-status/<str:order_id>/', views.update_payment_status_api, name='update_payment_status_api'),
    

]
