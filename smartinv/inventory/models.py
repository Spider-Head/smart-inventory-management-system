from django.db import models
from datetime import date
import qrcode
from io import BytesIO
from django.core.files import File
from django.db.models.signals import post_save
from django.dispatch import receiver
import uuid

# Product Category (supplier info moved here)
class ProductCategory(models.Model):
    category_id = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    image = models.ImageField(upload_to='category_images/', null=True, blank=True)
    supplier_name = models.CharField(max_length=255, blank=True, null=True)      # Moved here
    supplier_email = models.EmailField(blank=True, null=True)                    # Moved here

    def __str__(self):
        return f"{self.name} ({self.category_id})"

# Product Model
class Product(models.Model):
    category = models.ForeignKey(ProductCategory, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    pid = models.CharField(max_length=10, unique=True, editable=False, blank=True)
    quantity = models.PositiveIntegerField(default=0)
    expiry_date = models.DateField()
    added_date = models.DateField(auto_now_add=True)
    qr_code = models.ImageField(upload_to='qr_codes/', blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    rack = models.ForeignKey('Rack', on_delete=models.SET_NULL, null=True, blank=True, related_name='products')

    # supplier_name and supplier_email REMOVED

    def save(self, *args, **kwargs):
        if not self.pid:
            self.pid = str(uuid.uuid4().int)[:6]
        if not self.qr_code:
            self.generate_qr_code()
        super().save(*args, **kwargs)

    def generate_qr_code(self):
        qr = qrcode.make(str(self.pid))
        buffer = BytesIO()
        qr.save(buffer, format='PNG')
        filename = f"{self.pid}_qr.png"
        self.qr_code.save(filename, File(buffer), save=False)

    def __str__(self):
        return f"{self.name} ({self.pid}) - {self.category.name}"

@receiver(post_save, sender=Product)
def create_qr_code(sender, instance, created, **kwargs):
    if created and not instance.qr_code:
        instance.generate_qr_code()
        instance.save()

class WarehouseStock(models.Model):
    product = models.OneToOneField(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.product.name} - Stock: {self.quantity}"

class InventoryLog(models.Model):
    ACTION_CHOICES = [
        ('add', 'Add'),
        ('remove', 'Remove')
    ]
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    action = models.CharField(max_length=6, choices=ACTION_CHOICES)
    quantity = models.PositiveIntegerField(default=1)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.timestamp} | {self.product.name} | {self.action.upper()} | Qty: {self.quantity}"


class InventoryModel(models.Model):
    title = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    # Optionally, link to user/org for multi-user systems

    def __str__(self):
        return f"Layout: {self.title}"

class Shelf(models.Model):
    inventory = models.ForeignKey(InventoryModel, on_delete=models.CASCADE, related_name='shelves')
    index = models.PositiveIntegerField()  # Order on layout (e.g., shelf row 1, 2, 3)
    label = models.CharField(max_length=50, blank=True)  # User label (optional)

    def __str__(self):
        label = f" ({self.label})" if self.label else ""
        return f"Shelf {self.index}{label}"

class Rack(models.Model):
    shelf = models.ForeignKey(Shelf, on_delete=models.CASCADE, related_name='racks')
    index = models.PositiveIntegerField()  # Position in shelf (e.g., rack 1, 2, 3...)
    label = models.CharField(max_length=50, blank=True)  # User label ("Frozen", etc.)

    def __str__(self):
        label = f" ({self.label})" if self.label else ""
        return f"Shelf {self.shelf.index} - Rack {self.index}{label}"




from django.db import models
from django.utils.timezone import now

class StockMovement(models.Model):
    ACTION_CHOICES = [
        ('add', 'Stock In'),
        ('remove', 'Stock Out'),
    ]
    PAYMENT_STATUS_CHOICES = [
        ('paid', 'Paid'),
        ('pending', 'Pending'),
        ('failed', 'Failed'),
    ]

    order_id = models.CharField(max_length=20, unique=True)
    product = models.ForeignKey('Product', on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField()
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    purchaser_name = models.CharField(max_length=150, blank=True, null=True)
    contact_no = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    payment_status = models.CharField(max_length=10, choices=PAYMENT_STATUS_CHOICES, default='pending')
    timestamp = models.DateTimeField(default=now)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)


    def __str__(self):
        return f"{self.order_id} - {self.product.name} ({self.action})"


from django.db import models
from django.utils.timezone import now

class SensorData(models.Model):
    temperature = models.FloatField()
    humidity = models.FloatField()
    gas_level = models.FloatField(null=True, blank=True)  # optional for future use
    liquid_leak_detected = models.BooleanField(default=False)
    timestamp = models.DateTimeField(default=now)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"Temp: {self.temperature}°C | Humidity: {self.humidity}% at {self.timestamp}"
