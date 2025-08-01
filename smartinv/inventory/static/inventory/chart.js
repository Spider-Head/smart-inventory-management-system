const ctx = document.getElementById('lowStockCanvas').getContext('2d');
const labels = lowStockData.map(p => p.name);
const data = lowStockData.map(p => p.total_quantity);

new Chart(ctx, {
  type: 'bar',
  data: {
    labels: labels,
    datasets: [{
      label: 'Stock Quantity',
      data: data,
      backgroundColor: data.map(qty => qty <= 3 ? 'rgba(255, 99, 132, 0.7)' : 'rgba(54, 162, 235, 0.7)'),
      borderColor: 'rgba(0,0,0,0.1)',
      borderWidth: 1,
      borderRadius: 4,
    }]
  },
  options: {
    indexAxis: 'y',
    scales: {
      x: { beginAtZero: true },
      y: { beginAtZero: true }
    },
    responsive: true,
    plugins: {
      legend: { display: false }
    }
  }
});
