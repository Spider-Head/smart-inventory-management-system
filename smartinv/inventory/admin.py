# admin.py
from django.contrib import admin
from .models import Product, ProductCategory, WarehouseStock, InventoryLog

@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'category_id', 'image')

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'pid', 'category', 'added_date', 'expiry_date', 'quantity','supplier_name', 'supplier_email')
    search_fields = ('name', 'pid', 'category__name','supplier_name')
    list_filter = ('category', 'expiry_date')

@admin.register(WarehouseStock)
class WarehouseStockAdmin(admin.ModelAdmin):
    list_display = ('product', 'quantity')

@admin.register(InventoryLog)
class InventoryLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'product', 'action', 'quantity')
    list_filter = ('action', 'timestamp')
