# inventory/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('scan/', views.scan_page, name='scan-page'),
    path('product/<str:pid>/', views.get_product_by_pid, name='get-product'),  # ✅ Changed int to str
    path('remove/<str:pid>/', views.remove_product, name='remove-product'),
    path('warehouse/', views.get_all_warehouse_stock, name='get-all-warehouse-stock'),
    path('dashboard/', views.dashboard_view, name='dashboard'),

]
