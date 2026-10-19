// Tab Switching Logic
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

navItems.forEach(item => {
  item.addEventListener('click', () => {
    // Nonaktifkan semua tab & button
    navItems.forEach(nav => nav.classList.remove('active'));
    tabContents.forEach(tab => tab.classList.remove('active'));

    // Aktifkan tab yang dipilih
    item.classList.add('active');
    const targetTab = item.getAttribute('data-tab');
    document.getElementById(targetTab).classList.add('active');
  });
});

// Fitur Sembunyikan/Tampilkan Teks Arab (Toggle Sensor Murojaah)
const toggleHideBtn = document.getElementById('toggle-hide-btn');
const murojaahAyah = document.getElementById('murojaah-ayah-140');

toggleHideBtn.addEventListener('click', () => {
  murojaahAyah.classList.toggle('hidden-text');
});
