import os
import joblib
import pandas as pd
from django.core.management.base import BaseCommand
from inventory.models import StockMovement, Product
from prophet import Prophet

MODEL_DIR = os.path.join('inventory', 'prophet_models')


class Command(BaseCommand):
    help = "Train Prophet models for product demand forecasting (with synthetic daily data)."

    def handle(self, *args, **kwargs):
        os.makedirs(MODEL_DIR, exist_ok=True)

        products = Product.objects.all()

        for product in products:
            qs = StockMovement.objects.filter(
                product=product,
                action='remove'
            ).order_by('timestamp')

            if not qs.exists():
                self.stdout.write(f"Skipping {product.pid} — no usage logs")
                continue

            try:
                # -----------------------------------------------------
                # STEP 1: Convert QuerySet → DataFrame
                # -----------------------------------------------------
                df = pd.DataFrame(list(qs.values('timestamp', 'quantity')))
                df['ds'] = pd.to_datetime(df['timestamp']).dt.date

                df = df.groupby('ds', as_index=False)['quantity'].sum()
                df.rename(columns={'quantity': 'y'}, inplace=True)
                df['ds'] = pd.to_datetime(df['ds'])

                # -----------------------------------------------------
                # STEP 2: Synthetic Daily Filling (fixed dtype warnings)
                # -----------------------------------------------------
                min_date = df['ds'].min()
                max_date = df['ds'].max()

                full_range = pd.date_range(start=min_date, end=max_date, freq='D')
                synthetic_df = pd.DataFrame({'ds': full_range})

                # Force float dtype for safe assignment
                synthetic_df['y'] = 0.0

                # Spread real usage across missed days
                for i in range(len(df)):
                    day = df.iloc[i]['ds']
                    qty = float(df.iloc[i]['y'])

                    if i == 0:
                        # Assign full usage to the first day
                        synthetic_df.loc[synthetic_df['ds'] == day, 'y'] += qty
                    else:
                        prev_day = df.iloc[i - 1]['ds']
                        delta_days = (day - prev_day).days
                        if delta_days < 1:
                            delta_days = 1

                        spread_value = qty / delta_days

                        synthetic_df.loc[
                            (synthetic_df['ds'] > prev_day) & (synthetic_df['ds'] <= day),
                            'y'
                        ] += float(spread_value)

                # -----------------------------------------------------
                # STEP 3: Train Prophet Model
                # -----------------------------------------------------
                model = Prophet(
                    daily_seasonality=True,
                    weekly_seasonality=True,
                    yearly_seasonality=False
                )
                model.fit(synthetic_df)

                # -----------------------------------------------------
                # STEP 4: Save Model
                # -----------------------------------------------------
                model_path = os.path.join(MODEL_DIR, f"{product.pid}.pkl")
                joblib.dump(model, model_path)

                self.stdout.write(
                    self.style.SUCCESS(f"✔ Model saved for {product.pid} (synthetic daily data)")
                )

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"❌ Error training {product.pid}: {e}")
                )
