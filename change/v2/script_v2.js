// converter/script.js (Güncellenmiş Hali)

document.addEventListener('DOMContentLoaded', () => {
    // ... (Mevcut DOM element seçicileri aynı kalır) ...
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const statusDiv = document.getElementById('status');
    const downloadBtn = document.getElementById('download-btn');

    let convertedJsonData = null;
    let sourceFilename = 'karakter';

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    }

    // --- DÖNÜŞTÜRME FONKSİYONU (Sohbet Geçmişi EKLENDİ) ---
    function convertPerchanceDexieToAIChat(sourceJsonString) {
        try {
            const sourceData = JSON.parse(sourceJsonString);

            // 1. Gerekli Yapı ve Tabloları Doğrula
            if (!sourceData || sourceData.formatName !== "dexie" ||
                typeof sourceData.data !== 'object' || !Array.isArray(sourceData.data.data)) {
                throw new Error("Geçersiz kaynak JSON formatı. 'dexie' formatı ve beklenen iç içe 'data' yapısı bulunamadı.");
            }

            const tableArray = sourceData.data.data;
            const charactersTable = tableArray.find(table => table.tableName === "characters");
            const threadsTable = tableArray.find(table => table.tableName === "threads");
            const messagesTable = tableArray.find(table => table.tableName === "messages");

            if (!charactersTable || !Array.isArray(charactersTable.rows)) {
                throw new Error("Kaynak JSON içinde 'characters' tablosu veya karakter satırları bulunamadı.");
            }
            // Mesajlar ve threadler opsiyonel olabilir, hata vermeyelim ama kontrol edelim
            const hasMessages = messagesTable && Array.isArray(messagesTable.rows);
            const hasThreads = threadsTable && Array.isArray(threadsTable.rows);

            // 2. Hedef Yapıları Başlat
            const targetCharacters = [];
            const chatHistories = {}; // { "yeniKarakterId1": [{role:'user', content:'...'}], ... }

            // 3. Karakterleri ve Geçmişlerini İşle
            charactersTable.rows.forEach(sourceChar => {
                if (!sourceChar || !sourceChar.name) {
                    console.warn("İsimsiz veya geçersiz kaynak karakter verisi atlandı:", sourceChar);
                    return; // Bu karakteri atla
                }

                const newCharId = generateId(); // Her karakter için YENİ ID üret

                // --- Karakter Verisini Oluştur ---
                const targetChar = {
                    id: newCharId, // Üretilen yeni ID'yi kullan
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
                    // Diğer tüm alanlar... (önceki gibi)
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
                targetCharacters.push(targetChar);

                // --- Sohbet Geçmişini Bul ve İşle ---
                if (hasMessages && hasThreads && sourceChar.id != null) { // Kaynak karakter ID'si null olmamalı
                    // Bu karaktere ait thread'i bul (Genellikle tek olur varsayımı)
                    const sourceThread = threadsTable.rows.find(t => t.characterId === sourceChar.id);
                    if (sourceThread && sourceThread.id != null) {
                        const sourceThreadId = sourceThread.id;

                        // Bu thread'e ait mesajları al, sırala ve formatla
                        const history = messagesTable.rows
                            .filter(msg => msg.threadId === sourceThreadId)
                            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) // order'a göre sırala
                            .map(sourceMsg => ({
                                role: sourceMsg.characterId === -1 ? 'user' : 'assistant', // -1 kullanıcı, diğeri AI
                                content: sourceMsg.message || '' // Mesaj içeriği
                            }))
                            // Başlangıç mesajını (varsa) geçmişten çıkaralım, zaten initialMessage'da var
                            .filter((msg, index, arr) => !(index === 0 && msg.role === 'assistant' && targetChar.initialMessage.includes(msg.content)));

                        if (history.length > 0) {
                            chatHistories[newCharId] = history; // YENİ ID ile geçmişi kaydet
                        }
                    }
                }
            }); // End forEach sourceChar

            // 4. Son Hedef Formatını Oluştur (Yeni Format)
            const targetData = {
                version: 2, // Sürüm numarasını artır
                type: "AIChatCharacterAndHistoryData", // Yeni tip adı
                characters: targetCharacters,
                chatHistories: chatHistories // Geçmişleri ekle
            };

            // 5. Sonucu JSON String Olarak Döndür
            return JSON.stringify(targetData, null, 2);

        } catch (error) {
            console.error("Dönüştürme sırasında hata oluştu:", error);
            throw error;
        }
    }
    // --- Dönüştürme Fonksiyonu Sonu ---

    // --- handleFile ve diğer olay dinleyicileri (DEĞİŞİKLİK YOK) ---
    // ... (handleFile, drag/drop, click, download olay dinleyicileri önceki cevapta olduğu gibi kalacak) ...
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
                convertedJsonData = convertPerchanceDexieToAIChat(fileContent); // Güncellenmiş fonksiyonu çağırır

                if (convertedJsonData) {
                    // Başarı mesajını kontrol et (artık geçmiş de olabilir)
                    const parsedData = JSON.parse(convertedJsonData);
                    const charCount = parsedData.characters.length;
                    const historyCount = Object.keys(parsedData.chatHistories).length;
                    statusDiv.textContent = `Dosya başarıyla dönüştürüldü! (${charCount} karakter${historyCount > 0 ? ` ve ${historyCount} sohbet geçmişi` : ''} bulundu)`;
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

    // Olay Dinleyicileri (Önceki gibi)
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('drag-over'); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files; if (files.length > 0) { handleFile(files[0]); }
    });
    dropZone.addEventListener('click', () => { fileInput.click(); });
    fileInput.addEventListener('change', (e) => {
        const files = e.target.files; if (files.length > 0) { handleFile(files[0]); }
        fileInput.value = null;
    });
    downloadBtn.addEventListener('click', () => {
        if (!convertedJsonData) return;
        const blob = new Blob([convertedJsonData], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${sourceFilename}_converted_v2.json`; // Sürümü belirtebiliriz
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        URL.revokeObjectURL(url);
        statusDiv.textContent = 'Dönüştürülmüş dosya (v2) indirildi!';
        statusDiv.className = 'success';
    });

});