// Kategori renkleri ve işaretçi simgeleri
const categoryColors = {
    'İmam Hatip': 'red',
    'Anadolu Lisesi': 'blue',
    'Mesleki ve Teknik': 'green',
    'Eğitim Merkezi': 'grey',
    'Sosyal Bilimler': 'orange',
    'Fen Lisesi': 'yellow',
    'Çok Programlı': 'violet',
};

const categoryIcons = Object.fromEntries(
    Object.entries(categoryColors).map(([category, color]) => [
        category,
        new L.Icon({
            iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
        }),
    ])
);

const markers = [];

// JSON dosyasını yükle
fetch('output.json')
    .then((response) => response.json())
    .then((data) => {
        // Haritayı oluşturun ve Türkiye'nin merkezine yerleştirin
        const map = L.map('map').setView([38.963745, 35.243322], 6);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 22,
            minZoom: 6,
            bounds: [
                [33.2, 25.5], // Türkiye'nin güneybatı köşesi
                [42.2, 45.5]  // Türkiye'nin kuzeydoğu köşesi
            ]
        }).addTo(map);

        function saveFavoriteSchools() {
            localStorage.setItem('favoriteSchools', JSON.stringify(favoriteSchools));
        }

        function loadFavoriteSchools() {
            const storedFavoriteSchools = localStorage.getItem('favoriteSchools');
            if (storedFavoriteSchools) {
                return JSON.parse(storedFavoriteSchools);
            } else {
                return [];
            }
        }


        // Favori okulları saklamak için bir dizi
        const favoriteSchools = loadFavoriteSchools();
        updateFavoriteSchools();

        // Favori okulları listelemek için bir fonksiyon
        function updateFavoriteSchools() {
            const favoriteSchoolsList = document.getElementById('favoriteSchools');
            favoriteSchoolsList.innerHTML = '';

            favoriteSchools.forEach((school, index) => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.textContent = school['Okul Adı'];
                favoriteSchoolsList.appendChild(li);

                // Silme düğmesi ekle
                const deleteButton = document.createElement('button');
                deleteButton.className = 'btn btn-sm btn-danger ml-2';
                deleteButton.textContent = 'Sil';
                deleteButton.addEventListener('click', () => {
                    favoriteSchools.splice(index, 1);
                    updateFavoriteSchools();
                    saveFavoriteSchools();
                });
                li.appendChild(deleteButton);
            });
        }

        // JSON'dan okunan verileri kullanarak harita örneğini güncelle
        data.forEach((point) => {
            const marker = L.marker([point.Enlem, point.Boylam], { icon: categoryIcons[point.Kategori] });
            const popupContent = `
                  <b>Okul Adı:</b> ${point["Okul Adı"]}<br>
                  <b>Kontenjan:</b> ${point.Kontenjan}<br>
                  <b>Hizmet:</b> ${point.Hizmet}<br>
                  <b>Kategori:</b> ${point.Kategori}<br>
                  <b>Ana Sayfa:</b> <a href="${point["Ana Sayfa"]}" target="_blank">${point["Ana Sayfa"]}</a><br>
                  <b>İl:</b> ${point.İl}<br>
                  <b>İlçe:</b> ${point.İlçe}<br>
                  <button id="addToFavorites-${point['Kurum Kodu']}" class="btn btn-sm btn-outline-primary mt-2">Favorilere Ekle</button>
                  `;
            marker.bindPopup(popupContent);
            marker.on('popupopen', () => {
                const addToFavoritesButton = document.getElementById(`addToFavorites-${point['Kurum Kodu']}`);
                addToFavoritesButton.addEventListener('click', () => {
                    // Favori okullara ekle ve listeyi güncelle
                    favoriteSchools.push(point);
                    updateFavoriteSchools();
                    saveFavoriteSchools();

                    // Düğmeyi devre dışı bırak
                    addToFavoritesButton.disabled = true;
                    addToFavoritesButton.textContent = 'Favorilere Eklendi';
                });
            });
            markers.push({ point, marker });
        });

        // Filtreleme için seçenekleri doldurun
        const filterOptions = {
            il: new Set(),
            ilce: new Set(),
            kategori: new Set(),
            hizmet: new Set(),
        };

        data.forEach((point) => {
            filterOptions.il.add(point.İl);
            filterOptions.ilce.add(point.İlçe);
            filterOptions.kategori.add(point.Kategori);
            filterOptions.hizmet.add(point.Hizmet);
        });

        // Seçenekleri HTML'e ekle
        const populateSelect = (filter, options) => {
            const select = document.getElementById(filter);
            select.innerHTML = ""; // Önceki seçenekleri temizle
            Array.from(options).sort().forEach((option) => {
                const opt = document.createElement('option');
                opt.value = option;
                opt.textContent = option;
                select.appendChild(opt);
            });
        };

        Object.keys(filterOptions).forEach((filter) => {
            if (filter !== "ilce") {
                populateSelect(filter, filterOptions[filter]);
            }
        });

        // İl seçildiğinde ilçe filtresini güncelleyin
        document.getElementById('il').addEventListener('change', () => {
            const selectedIl = Array.from(document.getElementById('il').selectedOptions).map((opt) => opt.value);
            const ilceOptions = new Set(data.filter(point => selectedIl.includes(point.İl)).map(point => point.İlçe));
            populateSelect('ilce', ilceOptions);
        });

        // Filtreleri uygulayın ve haritayı güncelleyin
        const applyFilters = () => {
            const selectedFilters = {
                il: Array.from(document.getElementById('il').selectedOptions).map((opt) => opt.value),
                ilce: Array.from(document.getElementById('ilce').selectedOptions).map((opt) => opt.value),
                kategori: Array.from(document.getElementById('kategori').selectedOptions).map((opt) => opt.value),
                hizmet: Array.from(document.getElementById('hizmet').selectedOptions).map((opt) => opt.value),
            };

            markers.forEach(({ point, marker }) => {
                // Filtreleri kontrol et
                const shouldShow =
                    (selectedFilters.il.length === 0 || selectedFilters.il.includes(point.İl)) &&
                    (selectedFilters.ilce.length === 0 || selectedFilters.ilce.includes(point.İlçe)) &&
                    (selectedFilters.kategori.length === 0 || selectedFilters.kategori.includes(point.Kategori)) &&
                    (selectedFilters.hizmet.length === 0 || selectedFilters.hizmet.includes(point.Hizmet));

                if (shouldShow) {
                    marker.addTo(map);
                } else {
                    marker.remove();
                }
            });
        };

        const resetFilters = () => {
            const filterIds = ['il', 'ilce', 'kategori', 'hizmet'];
            filterIds.forEach((filterId) => {
                const select = document.getElementById(filterId);
                Array.from(select.options).forEach((option) => {
                    option.selected = false;
                });
            });

            // Filtreleri sıfırladıktan sonra haritayı güncelleyin
            applyFilters();
        };

        // Filtreleme formunu izleyin ve haritayı güncelleyin
        document.getElementById('filterForm').addEventListener('change', applyFilters);

        document.getElementById('resetFilters').addEventListener('click', resetFilters);

        applyFilters();
    });

