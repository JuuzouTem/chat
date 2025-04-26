document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const statusDiv = document.getElementById('status');
    const downloadBtn = document.getElementById('download-btn');

    let convertedJsonData = null;
    let sourceFilename = 'karakter'; // İndirme için varsayılan isim

    // --- ID Üretme Fonksiyonu (Asıl uygulamadan alındı) ---
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    }

    // --- Dönüştürme Fonksiyonu (ID Üretimi EKLENDİ) ---
    function convertPerchanceDexieToAIChat(sourceJsonString) {
        try {
            const sourceData = JSON.parse(sourceJsonString);

            // 1. Gerekli Yapıyı Doğrula
            if (!sourceData || sourceData.formatName !== "dexie" ||
                typeof sourceData.data !== 'object' ||
                !Array.isArray(sourceData.data.data)) {
                throw new Error("Geçersiz kaynak JSON formatı. 'dexie' formatı ve beklenen iç içe 'data' yapısı bulunamadı.");
            }

            // 2. Karakterler Tablosunu Bul
            const tableArray = sourceData.data.data;
            const charactersTable = tableArray.find(table => table.tableName === "characters");
            if (!charactersTable || !Array.isArray(charactersTable.rows)) {
                throw new Error("Kaynak JSON içinde 'characters' tablosu veya karakter satırları bulunamadı.");
            }

            // 3. Hedef Karakter Listesini Oluştur
            const targetCharacters = charactersTable.rows.map(sourceChar => {
                if (!sourceChar || !sourceChar.name) {
                    console.warn("İsimsiz veya geçersiz kaynak karakter verisi atlandı:", sourceChar);
                    return null;
                }

                // Hedef Karakter Nesnesini Oluştur (id: generateId() olarak değiştirildi)
                const targetChar = {
                    id: generateId(), // <-- DEĞİŞİKLİK BURADA
                    name: sourceChar.name || "İsimsiz Karakter",
                    avatar: sourceChar.avatar?.url || '',
                    description: sourceChar.roleInstruction || '',
                    initialMessage: (sourceChar.initialMessages || [])
                                      .map(msg => msg?.content ? `[AI]: ${msg.content.trim()}` : null)
                                      .filter(Boolean)
                                      .join('\n'),
                    provider: 'openrouter',
                    model: sourceChar.modelName || '',
                    reminderNote: sourceChar.reminderMessage || '',
                    generalInstructions: sourceChar.generalWritingInstructions && !sourceChar.generalWritingInstructions.startsWith('@') ? sourceChar.generalWritingInstructions : '',
                    inputPlaceholder: sourceChar.messageInputPlaceholder || '',
                    strictLength: (() => {
                        const count = sourceChar.maxParagraphCountPerMessage;
                        if (count === 1) return '1';
                        if (count === 2) return '2';
                        if (count && count > 2) return '3';
                        return '';
                    })(),
                    avatarSize: String(sourceChar.avatar?.size || ''),
                    avatarShape: sourceChar.avatar?.shape === 'square' ? 'square' : 'round',
                    overrideUserName: '', overrideUserAvatar: '', overrideUserDesc: '',
                    roleplayStyle: 'default', userAvatarSize: '', userAvatarShape: 'default',
                    messageStyle: sourceChar.messageWrapperStyle || '',
                    backgroundUrl: sourceChar.scene?.background?.url || '',
                    audioUrl: sourceChar.scene?.music?.url || '',
                    imgPromptStart: sourceChar.imagePromptPrefix || '',
                    imgPromptEnd: sourceChar.imagePromptSuffix || '',
                    imgTriggers: sourceChar.imagePromptTriggers || '',
                    lorebooks: (sourceChar.loreBookUrls || []).join('\n'),
                    contextMethod: sourceChar.fitMessagesInContextMethod === 'truncate' ? 'truncate' : 'summarize',
                    extendedMemory: 'disabled', shortcuts: '',
                    customJs: sourceChar.customCode || '',
                    socialTitle: sourceChar.metaTitle || '',
                    socialDesc: sourceChar.metaDescription || '',
                    socialImage: sourceChar.metaImage || '',
                };

                if (!targetChar.model) {
                     console.warn(`'${targetChar.name}' için model adı bulunamadı. Manuel olarak ayarlamanız gerekecek.`);
                }

                return targetChar;
            }).filter(Boolean);

            // 4. Son Hedef Formatını Oluştur
            const targetData = {
                version: 1,
                type: "AIChatCharacterData",
                characters: targetCharacters
            };

            // 5. Sonucu JSON String Olarak Döndür
            return JSON.stringify(targetData, null, 2);

        } catch (error) {
            console.error("Dönüştürme sırasında hata oluştu:", error);
            throw error;
        }
    }
    // --- Dönüştürme Fonksiyonu Sonu ---


    // Dosya İşleme Fonksiyonu (DEĞİŞİKLİK YOK)
    function handleFile(file) {
        statusDiv.textContent = '';
        statusDiv.className = '';
        downloadBtn.style.display = 'none';
        convertedJsonData = null;

        if (!file || !file.type.match('application/json')) {
            statusDiv.textContent = 'Hata: Lütfen geçerli bir JSON dosyası seçin.';
            statusDiv.className = 'error';
            return;
        }

        sourceFilename = file.name.replace(/\.json$/i, '');

        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const fileContent = e.target.result;
                convertedJsonData = convertPerchanceDexieToAIChat(fileContent);

                if (convertedJsonData) {
                    statusDiv.textContent = `Dosya başarıyla dönüştürüldü! (${JSON.parse(convertedJsonData).characters.length} karakter bulundu)`;
                    statusDiv.className = 'success';
                    downloadBtn.style.display = 'inline-block';
                    downloadBtn.disabled = false;
                } else {
                    statusDiv.textContent = 'Hata: Dönüştürme başarısız oldu (detaylar için konsola bakın).';
                    statusDiv.className = 'error';
                }
            } catch (error) {
                statusDiv.textContent = `Hata: ${error.message}`;
                statusDiv.className = 'error';
                console.error("İşleme hatası:", error);
            }
        };

        reader.onerror = function() {
            statusDiv.textContent = 'Hata: Dosya okunurken bir hata oluştu.';
            statusDiv.className = 'error';
        };

        reader.readAsText(file);
    }

    // Olay Dinleyicileri (DEĞİŞİKLİK YOK)
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
        fileInput.value = null;
    });

    downloadBtn.addEventListener('click', () => {
        if (!convertedJsonData) return;

        const blob = new Blob([convertedJsonData], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${sourceFilename}_converted.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        statusDiv.textContent = 'Dönüştürülmüş dosya indirildi!';
        statusDiv.className = 'success';
    });
});