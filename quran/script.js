// Data sederhana untuk uji coba interaksi Surah & Ayat
const quranData = {
  "1": { // Al-Fatihah
    name: "Al-Fatihah",
    ayahs: {
      "1": { ar: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", id: "Dengan nama Allah Yang Maha Pengasih, Maha Penyayang." },
      "2": { ar: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ", id: "Segala puji bagi Allah, Tuhan seluruh alam." },
      "3": { ar: "الرَّحْمَٰنِ الرَّحِيمِ", id: "Yang Maha Pengasih, Maha Penyayang." },
      "4": { ar: "مَالِكِ يَوْمِ الدِّينِ", id: "Pemilik hari pembalasan." }
    }
  },
  "112": { // Al-Ikhlas
    name: "Al-Ikhlas",
    ayahs: {
      "1": { ar: "قُلْ هُوَ اللَّهُ أَحَدٌ", id: "Katakanlah (Muhammad), 'Allah Yang Maha Esa'." },
      "2": { ar: "اللَّهُ الصَّمَدُ", id: "Allah tempat meminta segala sesuatu." },
      "3": { ar: "لَمْ يَلِدْ وَلَمْ يُولَدْ", id: "(Allah) tidak beranak dan tidak pula diperanakkan." },
      "4": { ar: "وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ", id: "Dan tidak ada sesuatu yang setara dengan Dia." }
    }
  }
};

const surahSelect = document.getElementById('surah-select');
const ayahSelect = document.getElementById('ayah-select');
const arabicText = document.getElementById('arabic-text');
const translationText = document.getElementById('translation-text');
const feedbackContent = document.getElementById('feedback-content');
const recordBtn = document.getElementById('record-btn');
const recLabel = document.getElementById('rec-label');

// Fungsi untuk memperbarui pilihan ayat berdasarkan Surah yang dipilih
function updateAyahOptions() {
  const selectedSurah = surahSelect.value;
  const ayahs = quranData[selectedSurah].ayahs;
  
  ayahSelect.innerHTML = '';
  for (let ayahNum in ayahs) {
    let opt = document.createElement('option');
    opt.value = ayahNum;
    opt.textContent = ayahNum;
    ayahSelect.appendChild(opt);
  }
  updateAyahDisplay();
}

// Fungsi untuk menampilkan teks Arab & Terjemahan sesuai pilihan
function updateAyahDisplay() {
  const selectedSurah = surahSelect.value;
  const selectedAyah = ayahSelect.value;
  
  if (quranData[selectedSurah] && quranData[selectedSurah].ayahs[selectedAyah]) {
    const data = quranData[selectedSurah].ayahs[selectedAyah];
    arabicText.textContent = data.ar;
    translationText.textContent = data.id;
  }
}

// Event Listeners
surahSelect.addEventListener('change', updateAyahOptions);
ayahSelect.addEventListener('change', updateAyahDisplay);

// Simulasi Interaksi Tombol Rekam Suara
let isRecording = false;
recordBtn.addEventListener('click', () => {
  if (!isRecording) {
    isRecording = true;
    recordBtn.style.background = '#33cc66';
    recLabel.textContent = "Mendengarkan bacaan...";
    feedbackContent.textContent = "🎤 Sedang merekam suara Anda... Silakan baca ayat di atas dengan tartil.";
    
    // Simulasi hasil analisis setelah 3 detik
    setTimeout(() => {
      isRecording = false;
      recordBtn.style.background = '#b5172f';
      recLabel.textContent = "Tekan & Baca";
      feedbackContent.textContent = "✅ Alhamdulillah! Pelafalan huruf dan panjang pendek (Mad) sudah cukup baik. Pertahankan makhrajnya!";
    }, 3000);
  }
});

// Inisialisasi awal
updateAyahOptions();
  
