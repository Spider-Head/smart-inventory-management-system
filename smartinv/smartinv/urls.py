"""
URL configuration for smartinv project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
# smartinv/urls.py
from django.contrib import admin
from django.urls import path, include
from inventory.views import home_view 
from inventory import views
from django.conf import settings
from django.conf.urls.static import static
from django.shortcuts import redirect

urlpatterns = [
    path('', views.landing_page, name='landing'),
    path('', lambda request: redirect('/inventory/scan/')),
    # path('', home_view),  # 🏠 Home page loads index.html
    path('admin/', admin.site.urls),  # 🛠 Admin panel
    path('inventory/', include('inventory.urls')),  # 🔗 Inventory app URLs
]

# ✅ Serve media (QR codes) in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
