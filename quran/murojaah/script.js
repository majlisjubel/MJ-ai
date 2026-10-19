document.addEventListener('DOMContentLoaded', () => {
  const btnToggleHide = document.getElementById('btnToggleHide');
  const quranContainer = document.getElementById('quranContainer');

  // Toggle Sembunyikan Teks Arab Total
  btnToggleHide.addEventListener('click', () => {
    quranContainer.classList.toggle('text-hidden');
    
    if (quranContainer.classList.contains('text-hidden')) {
      btnToggleHide.textContent = '🙈';
    } else {
      btnToggleHide.textContent = '👁️';
    }
  });
});
