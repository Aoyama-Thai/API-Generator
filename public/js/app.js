document.addEventListener('DOMContentLoaded', () => {
  initUsageChart();
  bindTestConnection();
  bindTestQuery();
});

function isEnglish() {
  return document.documentElement.lang === 'en';
}

function initUsageChart() {
  const canvas = document.getElementById('usageChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const labels = JSON.parse(canvas.dataset.labels || '[]');
  const values = JSON.parse(canvas.dataset.values || '[]');

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: isEnglish() ? 'API Calls' : 'จำนวนการเรียก API',
        data: values,
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

function bindTestConnection() {
  document.querySelectorAll('.test-conn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const res = await fetch(`/connections/${btn.dataset.id}/test`, { method: 'POST' });
        const data = await res.json();
        alert(data.message || data.error || (isEnglish() ? 'Test completed' : 'ทดสอบเสร็จสิ้น'));
      } catch (e) {
        alert((isEnglish() ? 'Error: ' : 'เกิดข้อผิดพลาด: ') + e.message);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function bindTestQuery() {
  document.querySelectorAll('.test-query').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const params = prompt(isEnglish() ? 'Parameters JSON (optional):' : 'Parameters JSON (ไม่บังคับ):', '{}');
      if (params === null) return;
      btn.disabled = true;
      try {
        const res = await fetch(`/sql-queries/${btn.dataset.id}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ params }),
        });
        const data = await res.json();
        if (data.success) {
          alert((isEnglish() ? 'Success! Rows: ' : 'สำเร็จ! แถว: ') + (data.data?.rowCount ?? data.data?.rows?.length ?? 0));
        } else {
          alert((isEnglish() ? 'Failed: ' : 'ผิดพลาด: ') + data.message);
        }
      } catch (e) {
        alert((isEnglish() ? 'Error: ' : 'เกิดข้อผิดพลาด: ') + e.message);
      } finally {
        btn.disabled = false;
      }
    });
  });
}
