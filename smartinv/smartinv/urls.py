from django.urls import path, include
from django.contrib import admin
from inventory import views
from django.conf import settings
from django.conf.urls.static import static
from django.shortcuts import redirect

urlpatterns = [
    path('', views.landing_page, name='landing'),
    path('', lambda request: redirect('/inventory/scan/')),
    path('admin/', admin.site.urls),
    path('inventory/', include(('inventory.urls', 'inventory'), namespace='inventory')),  # Register app namespace here
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
