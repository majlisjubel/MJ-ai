// Tab Switching Logic (Pills Navigasi Atas)
const navPills = document.querySelectorAll('.nav-pill');
const tabContents = document.querySelectorAll('.tab-content');

navPills.forEach(pill => {
  pill.addEventListener('click', () => {
    // Nonaktifkan semua pill & tab
    navPills.forEach(p => p.classList.remove('active'));
    tabContents.forEach(tab => tab.classList.remove('active'));

    // Aktifkan pill & tab yang diklik
    pill.classList.add('active');
    const targetTab = pill.getAttribute('data-tab');
    document.getElementById(targetTab).classList.add('active');
  });
});

// Fitur Sembunyikan/Tampilkan Teks Arab (Toggle Sensor Murojaah)
const toggleHideBtn = document.getElementById('toggle-hide-btn');
const murojaahAyah = document.getElementById('murojaah-ayah-140');

if (toggleHideBtn && murojaahAyah) {
  toggleHideBtn.addEventListener('click', () => {
    murojaahAyah.classList.toggle('hidden-text');
  });
}
