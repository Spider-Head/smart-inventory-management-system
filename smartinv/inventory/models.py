from django.db import models
from datetime import date
import qrcode
from io import BytesIO
from django.core.files import File
from django.db.models.signals import post_save
from django.dispatch import receiver
import uuid

# Product Category (unchanged)
class ProductCategory(models.Model):
    category_id = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.name} ({self.category_id})"

# Product Model
class Product(models.Model):
    category = models.ForeignKey(ProductCategory, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)  # ✅ Product name
    pid = models.CharField(max_length=10, unique=True, editable=False, blank=True)  # ✅ Unique Product ID
    quantity = models.PositiveIntegerField(default=0)  # Initial stock
    expiry_date = models.DateField()
    added_date = models.DateField(auto_now_add=True)
    qr_code = models.ImageField(upload_to='qr_codes/', blank=True, null=True)

    def save(self, *args, **kwargs):
        if not self.pid:
            self.pid = str(uuid.uuid4().int)[:6]  # Generates 6-digit unique PID
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

# ✅ Warehouse stock tracking (1:1 with Product)
class WarehouseStock(models.Model):
    product = models.OneToOneField(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.product.name} - Stock: {self.quantity}"

# ✅ Action logger: add/remove inventory entries
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
