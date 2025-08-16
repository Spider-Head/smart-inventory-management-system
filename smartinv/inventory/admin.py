from django.contrib import admin
from .models import Product, ProductCategory, WarehouseStock, InventoryLog

from .models import InventoryModel, Shelf, Rack

admin.site.register(InventoryModel)
admin.site.register(Shelf)
admin.site.register(Rack)
# ... (your existing registrations)


@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'category_id', 'image', 'supplier_name', 'supplier_email')
    search_fields = ('name', 'category_id', 'supplier_name', 'supplier_email')

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'pid', 'category', 'added_date', 'expiry_date', 'quantity',
        'get_supplier_name', 'get_supplier_email'
    )
    search_fields = ('name', 'pid', 'category__name', 'category__supplier_name')
    list_filter = ('category', 'expiry_date')

    def get_supplier_name(self, obj):
        return obj.category.supplier_name
    get_supplier_name.short_description = 'Supplier Name'

    def get_supplier_email(self, obj):
        return obj.category.supplier_email
    get_supplier_email.short_description = 'Supplier Email'

@admin.register(WarehouseStock)
class WarehouseStockAdmin(admin.ModelAdmin):
    list_display = ('product', 'quantity')

@admin.register(InventoryLog)
class InventoryLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'product', 'action', 'quantity')
    list_filter = ('action', 'timestamp')
