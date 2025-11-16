import pandas as pd
from inventory.models import DailyUsage

def get_clean_usage_dataframe(product):
    # Fetch usage logs
    logs = DailyUsage.objects.filter(product=product).order_by("date")

    if logs.count() < 10:
        return None  # too few records

    df = pd.DataFrame(list(logs.values("date", "quantity_used")))
    df = df.rename(columns={"date": "ds", "quantity_used": "y"})

    # Ensure datetime format
    df["ds"] = pd.to_datetime(df["ds"])

    # Reindex to fill missing days
    full_range = pd.date_range(df["ds"].min(), df["ds"].max(), freq="D")
    df = df.set_index("ds").reindex(full_range, fill_value=0).reset_index()
    df.columns = ["ds", "y"]

    return df
