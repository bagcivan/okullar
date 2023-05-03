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

// DOM seçicilerini değişkenlere atayarak yeniden kullanılabilir hale getirelim
const favoriteSchoolsTableBody = document.querySelector("#favoriteSchools tbody");
const filterForm = document.getElementById('filterForm');
const ilSelect = document.getElementById('il');
const ilceSelect = document.getElementById('ilce');
const kategoriSelect = document.getElementById('kategori');
const hizmetSelect = document.getElementById('hizmet');
const resetFiltersButton = document.getElementById('resetFilters');

// Favori okulları saklamak için bir dizi
const favoriteSchools = loadFavoriteSchools();
renderFavoriteSchools();

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

function renderFavoriteSchools() {
    // ... (Favori okulları listelemek için aynı kod)
    const favoriteSchoolsTableBody = document.querySelector("#favoriteSchools tbody");
    favoriteSchoolsTableBody.innerHTML = "";

    favoriteSchools.forEach((school, index) => {
        const tr = document.createElement("tr");
        tr.setAttribute("data-id", index);
        tr.setAttribute("data-school", encodeURIComponent(JSON.stringify(school)));

        // Okul bilgilerini ekle
        const schoolInfo = `
          <td>${index + 1}</td>
          <td>${school["Okul Adı"]}</td>
          <td>${school["İl"]}</td>
          <td>${school["İlçe"]}</td>
          <td>${school["Kategori"]}</td>
          <td>${school["Hizmet"]}</td>
          <td><a href="${school["Ana Sayfa"]}" target="_blank">${school["Ana Sayfa"]}</a></td>
          <td><button class="btn btn-sm btn-danger">Sil</button></td>
          `;
        tr.innerHTML = schoolInfo;

        // Silme düğmesi işlevselliğini ekle
        const deleteButton = tr.querySelector("button");
        deleteButton.addEventListener("click", () => {
            favoriteSchools.splice(index, 1);
            renderFavoriteSchools();
            saveFavoriteSchools();
        });

        favoriteSchoolsTableBody.appendChild(tr);
    });

    updateSortable();
}

function updateSortable() {
    // ... (Sortable güncellemesi için aynı kod)
    const favoriteSchoolsTableBody = document.querySelector("#favoriteSchools tbody");
    const sortable = Sortable.create(favoriteSchoolsTableBody, {
        animation: 150,
        onUpdate: function () {
            const newOrder = sortable.toArray().map((id) => {
                const schoolStr = favoriteSchoolsTableBody.querySelector(`tr[data-id="${id}"]`).getAttribute("data-school");
                const school = JSON.parse(decodeURIComponent(schoolStr));
                return favoriteSchools.find((fs) => fs["Kurum Kodu"] === school["Kurum Kodu"]);
            });
            favoriteSchools.length = 0;
            favoriteSchools.push(...newOrder);
            renderFavoriteSchools();
            saveFavoriteSchools();
        },
    });
}

function initializeMapAndFilters(data) {
    // Haritayı oluşturun ve Türkiye'nin merkezine yerleştirin
    const map = L.map('map').setView([39.254845, 35.243322], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 22,
        minZoom: 6,
        bounds: [
            [33.2, 25.5], // Türkiye'nin güneybatı köşesi
            [42.2, 45.5]  // Türkiye'nin kuzeydoğu köşesi
        ]
    }).addTo(map);

    // JSON'dan okunan verileri kullanarak harita örneğini güncelle
    // ve filtreleme seçeneklerini doldurun
    const filterOptions = {
        il: new Set(),
        ilce: new Set(),
        kategori: new Set(),
        hizmet: new Set(),
    };

    data.forEach((point) => {
        // Harita işaretçilerini oluşturun
        const marker = L.marker([point.Enlem, point.Boylam], {
            icon: categoryIcons[point.Kategori],
        });

        // İşaretçilere pop-up ekleyin
        const popupContent = `
          <strong>${point["Okul Adı"]}</strong><br>
          ${point["İl"]}, ${point["İlçe"]}<br>
          ${point["Kategori"]}<br>
          ${point["Hizmet"]}<br>
          <a href="${point["Ana Sayfa"]}" target="_blank">Ana Sayfa</a><br>
          <button class="btn btn-sm btn-primary">Favorilere Ekle</button>
        `;
        marker.bindPopup(popupContent);

        // İşaretçilere favorilere ekleme işlevselliği ekleyin
        marker.on('popupopen', (e) => {
            const popup = e.popup;
            const addButton = popup.getElement().querySelector('button');
            addButton.addEventListener('click', () => {
                favoriteSchools.push(point);
                renderFavoriteSchools();
                saveFavoriteSchools();

                // Düğmeyi devre dışı bırak
                addButton.disabled = true;
                addButton.textContent = 'Favorilere Eklendi';
            });
        });

        // İşaretçileri ve noktaları saklayın
        markers.push({ point, marker });

        filterOptions.il.add(point.İl);
        filterOptions.ilce.add(point.İlçe);
        filterOptions.kategori.add(point.Kategori);
        filterOptions.hizmet.add(point.Hizmet);
    });

    Object.keys(filterOptions).forEach((filter) => {
        if (filter !== "ilce") {
            populateSelect(filter, filterOptions[filter]);
        }
    });

    // İl seçildiğinde ilçe filtresini güncelleyin
    ilSelect.addEventListener('change', () => updateIlceOptions(data));

    // Filtreleme formunu izleyin ve haritayı güncelleyin
    filterForm.addEventListener('change', () => applyFilters(map));
    resetFiltersButton.addEventListener('click', () => resetFilters(map));

    applyFilters(map);

    return { map, data };
}

function applyFilters(map) {
    // ... (Filtreleri uygulayıp haritayı güncelleyen fonksiyon)
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
}

function resetFilters(map) {
    // ... (Filtreleri sıfırlayan ve haritayı güncelleyen fonksiyon)
    const filterIds = ['il', 'ilce', 'kategori', 'hizmet'];
    filterIds.forEach((filterId) => {
        const select = document.getElementById(filterId);
        Array.from(select.options).forEach((option) => {
            option.selected = false;
        });
    });

    // Filtreleri sıfırladıktan sonra haritayı güncelleyin
    applyFilters(map);
}

function updateIlceOptions(data) {
    // ... (İl seçildiğinde ilçe filtresini güncelleyen fonksiyon)
    const selectedIl = Array.from(ilSelect.selectedOptions).map((opt) => opt.value);
    const ilceOptions = new Set(data.filter(point => selectedIl.includes(point.İl)).map(point => point.İlçe));
    populateSelect('ilce', ilceOptions);
}

function populateSelect(filter, options) {
    // ... (Seçenekleri HTML'e ekleyen fonksiyon)
    const select = document.getElementById(filter);
    select.innerHTML = ""; // Önceki seçenekleri temizle
    Array.from(options).sort().forEach((option) => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        select.appendChild(opt);
    });
}

let map;

// JSON dosyasını yükle
fetch('output.json')
    .then((response) => response.json())
    .then(initializeMapAndFilters);
