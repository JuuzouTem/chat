// converter/script.js (Ters Dönüşüm İçin Güncellenmiş Hali)

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const statusDiv = document.getElementById('status');
    const downloadBtn = document.getElementById('download-btn');

    let convertedJsonData = null;
    let sourceFilename = 'aichat_data';

    // Dexie için basit sayısal ID üreteci
    let nextCharacterId = 0;
    let nextThreadId = 0;
    let nextMessageId = 0;

    function generateTimestamp() {
        return Date.now();
    }

    // --- DÖNÜŞTÜRME FONKSİYONU (AI Chat -> Perchance Dexie) ---
    function convertAIChatToPerchanceDexie(sourceJsonString) {
        try {
            const sourceData = JSON.parse(sourceJsonString);

            // 1. Kaynak Formatı Doğrula (V1 veya V2)
            if (!sourceData || (sourceData.type !== "AIChatCharacterData" && sourceData.type !== "AIChatCharacterAndHistoryData") || !Array.isArray(sourceData.characters)) {
                throw new Error("Geçersiz kaynak JSON formatı. 'AIChatCharacterData' veya 'AIChatCharacterAndHistoryData' tipi ve 'characters' dizisi bulunamadı.");
            }
            const isV2 = sourceData.type === "AIChatCharacterAndHistoryData" && typeof sourceData.chatHistories === 'object';

            // 2. Hedef Dexie Yapısını Başlat
            const targetData = {
                formatName: "dexie",
                formatVersion: 1,
                data: {
                    databaseName: "chatbot-ui-v1", // Tipik değer
                    databaseVersion: 90.1,      // Tipik değer
                    tables: [ // Şemaları tanımla, rowCount başlangıçta 0
                        { name: "characters", schema: "++id,modelName,fitMessagesInContextMethod,uuid,creationTime,lastMessageTime,folderPath", rowCount: 0 },
                        { name: "threads", schema: "++id,name,characterId,creationTime,lastMessageTime,lastViewTime,folderPath", rowCount: 0 },
                        { name: "messages", schema: "++id,threadId,characterId,creationTime,order", rowCount: 0 },
                        { name: "misc", schema: "key", rowCount: 0 },
                        { name: "summaries", schema: "hash,threadId", rowCount: 0 },
                        { name: "memories", schema: "++id,[summaryHash+threadId],[characterId+status],[threadId+status],[threadId+index],threadId", rowCount: 0 },
                        { name: "lore", schema: "++id,bookId,bookUrl", rowCount: 0 },
                        { name: "textEmbeddingCache", schema: "++id,textHash,&[textHash+modelName]", rowCount: 0 },
                        { name: "textCompressionCache", schema: "++id,uncompressedTextHash,&[uncompressedTextHash+modelName+tokenLimit]", rowCount: 0 }
                    ],
                    data: [] // Veri tabloları buraya eklenecek
                }
            };

            const characterRows = [];
            const threadRows = [];
            const messageRows = [];
            const sourceIdToDexieIdMap = {}; // AI Chat ID -> Dexie ID eşlemesi

            // ID sayaçlarını sıfırla
            nextCharacterId = 0;
            nextThreadId = 0;
            nextMessageId = 0;

            const currentTime = generateTimestamp();

            // 3. Karakterleri İşle
            sourceData.characters.forEach(sourceChar => {
                if (!sourceChar || !sourceChar.id || !sourceChar.name) {
                    console.warn("ID veya isim içermeyen kaynak karakter verisi atlandı:", sourceChar);
                    return; // Bu karakteri atla
                }

                const dexieCharId = nextCharacterId++;
                sourceIdToDexieIdMap[sourceChar.id] = dexieCharId; // Eşlemeyi kaydet

                // Initial message'ları parse et
                const initialMessages = [];
                if (sourceChar.initialMessage) {
                    const lines = sourceChar.initialMessage.split('\n');
                    lines.forEach(line => {
                        const match = line.match(/^\[AI\]:\s*(.*)/);
                        if (match && match[1]) {
                            initialMessages.push({ author: 'ai', content: match[1].trim() });
                        } else if (line.trim()) { // Sadece [AI]: olmayan ama boş da olmayan satırlar varsa (emin olmak için)
                             initialMessages.push({ author: 'ai', content: line.trim() }); // Varsayılan olarak AI'ye ata
                        }
                    });
                }

                 // Strict length'i maxParagraphCount'a çevir
                 let maxParagraphCount = 0;
                 if (sourceChar.strictLength === '1') maxParagraphCount = 1;
                 else if (sourceChar.strictLength === '2') maxParagraphCount = 2;
                 else if (sourceChar.strictLength === '3') maxParagraphCount = 3; // Veya daha büyük bir sayı, 3 mantıklı

                const dexieChar = {
                    id: dexieCharId,
                    name: sourceChar.name || "İsimsiz Karakter",
                    roleInstruction: sourceChar.description || '',
                    modelName: sourceChar.model || 'perchance-ai', // Model adı yoksa varsayılan
                    fitMessagesInContextMethod: sourceChar.contextMethod === 'truncate' ? 'truncate' : 'summarizeOld', // 'summarize' yerine 'summarizeOld' daha yaygın olabilir
                    uuid: null, // Genellikle null veya özel bir uuid
                    creationTime: currentTime,
                    lastMessageTime: currentTime, // Başlangıçta aynı olabilir
                    folderPath: "",
                    maxParagraphCountPerMessage: maxParagraphCount, // Dönüştürülen değer
                    reminderMessage: sourceChar.reminderNote || '',
                    // generalInstructions'ı @ ile başlıyorsa olduğu gibi, değilse metin olarak al
                    generalWritingInstructions: (sourceChar.generalInstructions || '').startsWith('@') ? sourceChar.generalInstructions : sourceChar.generalInstructions,
                    messageWrapperStyle: sourceChar.messageStyle || '',
                    imagePromptPrefix: sourceChar.imgPromptStart || '',
                    imagePromptSuffix: sourceChar.imgPromptEnd || '',
                    imagePromptTriggers: sourceChar.imgTriggers || '',
                    customCode: sourceChar.customJs || '',
                    messageInputPlaceholder: sourceChar.inputPlaceholder || '',
                    metaTitle: sourceChar.socialTitle || '',
                    metaDescription: sourceChar.socialDesc || '',
                    metaImage: sourceChar.socialImage || '',
                    temperature: 0.8, // Varsayılan değer
                    maxTokensPerMessage: 500, // Varsayılan değer
                    textEmbeddingModelName: "Xenova/bge-base-en-v1.5", // Varsayılan değer
                    initialMessages: initialMessages,
                    shortcutButtons: [], // Genellikle boş başlar
                    loreBookUrls: (sourceChar.lorebooks || '').split('\n').filter(Boolean), // lorebooks'u diziye çevir
                    avatar: {
                        url: sourceChar.avatar || '',
                        size: parseInt(sourceChar.avatarSize, 10) || 6, // Varsayılan boyut
                        shape: sourceChar.avatarShape === 'square' ? 'square' : 'round' // Varsayılan round
                    },
                    scene: {
                        background: { url: sourceChar.backgroundUrl || '' },
                        music: { url: sourceChar.audioUrl || '' }
                    },
                    userCharacter: { avatar: {} }, // Genellikle boş
                    systemCharacter: { avatar: {} }, // Genellikle boş
                    streamingResponse: true, // Genellikle true
                    customData: {},
                    // Diğer potansiyel Dexie alanları için varsayılanlar...
                    autoGenerateMemories: "none",
                    userMessagesSentHistory:[],
                    currentSummaryHashChain: [],
                    "$types": { // Dexie'nin beklediği tipler (gerekliyse)
                        "maxParagraphCountPerMessage": "undef",
                        "initialMessages": "arrayNonindexKeys",
                        "shortcutButtons": "arrayNonindexKeys",
                        "loreBookUrls": "arrayNonindexKeys",
                        "userMessagesSentHistory":"arrayNonindexKeys",
                        "currentSummaryHashChain":"arrayNonindexKeys"
                        // Diğer array tipleri buraya eklenebilir
                    }
                };
                characterRows.push(dexieChar);
            }); // End forEach sourceChar

            // 4. Sohbet Geçmişini İşle (Sadece V2 ise)
            if (isV2 && sourceData.chatHistories) {
                Object.entries(sourceData.chatHistories).forEach(([sourceCharId, history]) => {
                    const dexieCharId = sourceIdToDexieIdMap[sourceCharId];
                    if (dexieCharId === undefined || !Array.isArray(history) || history.length === 0) {
                        console.warn(`Karakter ID ${sourceCharId} için Dexie ID bulunamadı veya geçmiş boş/geçersiz, atlanıyor.`);
                        return; // Bu geçmişi atla
                    }

                    const dexieThreadId = nextThreadId++;
                    const threadCreationTime = generateTimestamp(); // Thread için ayrı zaman

                    // Thread satırını oluştur
                    const dexieThread = {
                        id: dexieThreadId,
                        name: "İçe Aktarılan Sohbet", // Veya karakter adını kullan: characterRows.find(c=>c.id===dexieCharId)?.name || "İçe Aktarılan Sohbet"
                        characterId: dexieCharId,
                        creationTime: threadCreationTime,
                        lastMessageTime: threadCreationTime, // Başlangıçta aynı
                        lastViewTime: threadCreationTime, // Başlangıçta aynı
                        folderPath: "",
                        isFav: false,
                        userCharacter: { avatar: {} },
                        systemCharacter: { avatar: {} },
                        character: { avatar: {} }, // Boş bırakılabilir veya karakterden alınabilir
                        modelName: characterRows.find(c=>c.id===dexieCharId)?.modelName || 'perchance-ai',
                        customCodeWindow: { visible: false, width: null },
                        customData: {},
                        loreBookId: null, // Varsa atanabilir, şimdilik null
                        textEmbeddingModelName: "Xenova/bge-base-en-v1.5", // Varsayılan
                        userMessagesSentHistory: [],
                        unsentMessageText: "",
                        shortcutButtons: [ // Varsayılan thread kısayolları
                             {"name":"🗣️ {{char}}","message":"/ai <optional writing instruction>","insertionType":"replace","autoSend":false,"type":"message"},
                             {"name":"🗣️ {{user}}","message":"/user <optional writing instruction>","insertionType":"replace","autoSend":false,"type":"message"},
                             {"name":"🗣️ Narrator","message":"/nar <optional writing instruction>","insertionType":"replace","autoSend":false,"type":"message"},
                             {"name":"🖼️ Image","message":"/image --num=3","insertionType":"replace","autoSend":true,"type":"message"}
                        ],
                        currentSummaryHashChain: [],
                         "$types": {
                            "userMessagesSentHistory": "arrayNonindexKeys",
                            "shortcutButtons": "arrayNonindexKeys",
                            "currentSummaryHashChain": "arrayNonindexKeys"
                        }
                    };
                    threadRows.push(dexieThread);

                    // Mesajları işle
                    let lastMsgTime = threadCreationTime;
                    history.forEach((message, index) => {
                        if (!message || typeof message.content !== 'string' || (message.role !== 'user' && message.role !== 'assistant')) {
                           console.warn("Geçersiz mesaj formatı atlandı:", message);
                           return;
                        }
                        const msgTime = lastMsgTime + (index + 1) * 10; // Mesajlar arasına küçük zaman farkı ekle
                        lastMsgTime = msgTime; // Son mesaj zamanını güncelle

                        const dexieMessage = {
                            id: nextMessageId++,
                            threadId: dexieThreadId,
                            characterId: message.role === 'user' ? -1 : dexieCharId, // -1 kullanıcı için
                            message: message.content,
                            order: index, // Sıralama önemli
                            creationTime: msgTime,
                            // Dexie'nin beklediği diğer alanlar için varsayılanlar
                            hiddenFrom: [],
                            expectsReply: 0, // veya undef
                            variants: [null],
                            memoryIdBatchesUsed: [],
                            loreIdsUsed: [],
                            summaryHashUsed: null,
                            summariesUsed: null,
                            summariesEndingHere: null,
                            memoriesEndingHere: null,
                            memoryQueriesUsed: [],
                            messageIdsUsed: [],
                            name: null,
                            scene: null,
                            avatar: {},
                            customData: {},
                            wrapperStyle: "",
                            instruction: null,
                             "$types": {
                                "hiddenFrom": "arrayNonindexKeys",
                                "expectsReply": "undef",
                                "variants": "arrayNonindexKeys",
                                "memoryIdBatchesUsed": "arrayNonindexKeys",
                                "loreIdsUsed": "arrayNonindexKeys",
                                "memoryQueriesUsed": "arrayNonindexKeys",
                                "messageIdsUsed": "arrayNonindexKeys"
                            }
                        };
                        messageRows.push(dexieMessage);
                    });

                     // Thread'in son mesaj zamanını güncelle
                     dexieThread.lastMessageTime = lastMsgTime;

                }); // End forEach chatHistory entry
            } // End if(isV2)

            // 5. Veri Kısmını Oluştur
            targetData.data.data = [
                { tableName: "characters", inbound: true, rows: characterRows },
                { tableName: "threads", inbound: true, rows: threadRows },
                { tableName: "messages", inbound: true, rows: messageRows },
                { tableName: "misc", inbound: true, rows: [] },
                { tableName: "summaries", inbound: true, rows: [] },
                { tableName: "memories", inbound: true, rows: [] },
                { tableName: "lore", inbound: true, rows: [] },
                { tableName: "textEmbeddingCache", inbound: true, rows: [] },
                { tableName: "textCompressionCache", inbound: true, rows: [] }
            ];

             // 6. RowCount'ları Güncelle
             targetData.data.tables.find(t => t.name === 'characters').rowCount = characterRows.length;
             targetData.data.tables.find(t => t.name === 'threads').rowCount = threadRows.length;
             targetData.data.tables.find(t => t.name === 'messages').rowCount = messageRows.length;
             // Diğerleri zaten 0 olarak ayarlandı

            // 7. Sonucu JSON String Olarak Döndür
            return JSON.stringify(targetData, null, 2); // Pretty print

        } catch (error) {
            console.error("Dönüştürme sırasında hata oluştu:", error);
            throw error; // Hatanın yukarıya iletilmesi
        }
    }
    // --- Dönüştürme Fonksiyonu Sonu ---

    // --- handleFile ve diğer olay dinleyicileri (Ufak Değişikliklerle) ---
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

        sourceFilename = file.name.replace(/\.json$/i, ''); // İsimlendirme için dosya adını al

        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const fileContent = e.target.result;
                convertedJsonData = convertAIChatToPerchanceDexie(fileContent); // YENİ fonksiyonu çağırır

                if (convertedJsonData) {
                    // Başarı mesajını kontrol et
                    const parsedData = JSON.parse(convertedJsonData); // Geri parse etmeye gerek yok aslında ama sayım için yapılabilir
                    const charCount = parsedData.data.tables.find(t => t.name === 'characters').rowCount;
                    const threadCount = parsedData.data.tables.find(t => t.name === 'threads').rowCount;
                    statusDiv.textContent = `Dosya başarıyla Perchance Dexie formatına dönüştürüldü! (${charCount} karakter${threadCount > 0 ? ` ve ${threadCount} sohbet` : ''} bulundu)`;
                    statusDiv.className = 'success';
                    downloadBtn.style.display = 'inline-block';
                    downloadBtn.disabled = false;
                } else {
                    // Bu blok normalde convert fonksiyonu hata fırlattığı için çalışmaz, ama güvenlik için kalabilir
                    statusDiv.textContent = 'Hata: Dönüştürme başarısız oldu (detaylar için konsola bakın).';
                    statusDiv.className = 'error';
                }
            } catch (error) {
                statusDiv.textContent = `Hata: ${error.message}`; // Fonksiyondan gelen hatayı göster
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
        fileInput.value = null; // Tekrar aynı dosyayı seçebilmek için sıfırla
    });
    downloadBtn.addEventListener('click', () => {
        if (!convertedJsonData) return;
        const blob = new Blob([convertedJsonData], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        // İndirilen dosya adını güncelle
        link.download = `${sourceFilename}_converted_perchance.json`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        URL.revokeObjectURL(url);
        // Başarı mesajını güncelle
        statusDiv.textContent = 'Dönüştürülmüş Perchance dosyası indirildi!';
        statusDiv.className = 'success';
    });

});