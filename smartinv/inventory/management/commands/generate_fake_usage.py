from django.core.management.base import BaseCommand
from inventory.models import Product, DailyUsage
from datetime import datetime, timedelta
import random

class Command(BaseCommand):
    help = "Generate 30 days of fake daily usage for testing Prophet forecasting"

    def handle(self, *args, **kwargs):
        products = Product.objects.all()
        today = datetime.today().date()

        if not products.exists():
            self.stdout.write(self.style.ERROR("No products found! Add products first."))
            return

        for product in products:
            for i in range(30):  # last 30 days
                day = today - timedelta(days=i)
                usage = random.randint(1, 10)  # random daily consumption

                DailyUsage.objects.update_or_create(
                    product=product,
                    date=day,
                    defaults={"quantity_used": usage}
                )

        self.stdout.write(self.style.SUCCESS("✔ 30 days of fake usage data created successfully!"))
