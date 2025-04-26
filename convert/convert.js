document.addEventListener('DOMContentLoaded', () => {
    // --- Global State ---
    // Stores data for the currently active converter section
    const converterState = {
        activeConverterId: null,
        convertedJsonData: null,
        sourceFilename: 'converted_data',
        downloadFilename: 'converted_data.json'
    };

    // --- DOM Elements ---
    const navButtons = document.querySelectorAll('.nav-btn');
    const converterSections = document.querySelectorAll('.converter-section');

    // Section-specific elements (using IDs for easier access)
    const elements = {
        'converter-p1-ai': {
            section: document.getElementById('converter-p1-ai'),
            dropZone: document.getElementById('drop-zone-p1-ai'),
            fileInput: document.getElementById('file-input-p1-ai'),
            statusDiv: document.getElementById('status-p1-ai'),
            downloadBtn: document.getElementById('download-btn-p1-ai'),
            converterFunc: convertP1ToAI, // Assign specific function
            defaultFilenameBase: 'aichat_v1',
            downloadSuffix: '_aichat_v1.json'
        },
        'converter-p2-ai': {
            section: document.getElementById('converter-p2-ai'),
            dropZone: document.getElementById('drop-zone-p2-ai'),
            fileInput: document.getElementById('file-input-p2-ai'),
            statusDiv: document.getElementById('status-p2-ai'),
            downloadBtn: document.getElementById('download-btn-p2-ai'),
            converterFunc: convertP2ToAI,
            defaultFilenameBase: 'aichat_v2',
            downloadSuffix: '_aichat_v2_history.json'
        },
        'converter-ai-p': {
            section: document.getElementById('converter-ai-p'),
            dropZone: document.getElementById('drop-zone-ai-p'),
            fileInput: document.getElementById('file-input-ai-p'),
            statusDiv: document.getElementById('status-ai-p'),
            downloadBtn: document.getElementById('download-btn-ai-p'),
            converterFunc: convertAIToP,
            defaultFilenameBase: 'perchance_dexie',
            downloadSuffix: '_perchance_dexie.json'
        }
    };

    // --- Helper Functions ---
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    }

    function generateTimestamp() {
        return Date.now();
    }

    // ID counters for reverse conversion (reset each time)
    let nextCharacterId = 0;
    let nextThreadId = 0;
    let nextMessageId = 0;

    // --- Conversion Function 1: Perchance V1 (ID Gen) -> AIChat ---
    function convertP1ToAI(sourceJsonString) {
        try {
            const sourceData = JSON.parse(sourceJsonString);
             // Validation (same as script_v1.js)
             if (!sourceData || sourceData.formatName !== "dexie" ||
                typeof sourceData.data !== 'object' ||
                !Array.isArray(sourceData.data.data)) {
                throw new Error("Geçersiz kaynak JSON formatı (V1). 'dexie' formatı ve beklenen 'data' yapısı bulunamadı.");
            }
            const tableArray = sourceData.data.data;
            const charactersTable = tableArray.find(table => table.tableName === "characters");
            if (!charactersTable || !Array.isArray(charactersTable.rows)) {
                throw new Error("Kaynak JSON içinde 'characters' tablosu veya satırları bulunamadı (V1).");
            }

            const targetCharacters = charactersTable.rows.map(sourceChar => {
                 if (!sourceChar || !sourceChar.name) {
                    console.warn("İsimsiz veya geçersiz kaynak karakter verisi atlandı (V1):", sourceChar);
                    return null;
                }
                // Mapping logic (same as script_v1.js)
                const targetChar = {
                    id: generateId(), // Generate new ID
                    name: sourceChar.name || "İsimsiz Karakter",
                    avatar: sourceChar.avatar?.url || '',
                    description: sourceChar.roleInstruction || '',
                    initialMessage: (sourceChar.initialMessages || [])
                                      .map(msg => msg?.content ? `[AI]: ${msg.content.trim()}` : null)
                                      .filter(Boolean)
                                      .join('\n'),
                    provider: 'openrouter',
                    model: sourceChar.modelName || '',
                    // ... (include all other fields from script_v1.js map)
                    reminderNote: sourceChar.reminderMessage || '',
                    generalInstructions: sourceChar.generalWritingInstructions && !sourceChar.generalWritingInstructions.startsWith('@') ? sourceChar.generalWritingInstructions : '',
                    inputPlaceholder: sourceChar.messageInputPlaceholder || '',
                    strictLength: (() => { const count = sourceChar.maxParagraphCountPerMessage; if (count === 1) return '1'; if (count === 2) return '2'; if (count && count > 2) return '3'; return ''; })(),
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
                 if (!targetChar.model) console.warn(`'${targetChar.name}' için model adı bulunamadı (V1).`);
                return targetChar;
            }).filter(Boolean);

            const targetData = {
                version: 1,
                type: "AIChatCharacterData",
                characters: targetCharacters
            };
            return JSON.stringify(targetData, null, 2);
        } catch (error) {
            console.error("Dönüştürme sırasında hata oluştu (V1 -> AIChat):", error);
            throw error; // Re-throw for handleFile
        }
    }

    // --- Conversion Function 2: Perchance V2 (History) -> AIChat ---
    function convertP2ToAI(sourceJsonString) {
         try {
            const sourceData = JSON.parse(sourceJsonString);
            // Validation (same as script_v2.js)
            if (!sourceData || sourceData.formatName !== "dexie" ||
                typeof sourceData.data !== 'object' || !Array.isArray(sourceData.data.data)) {
                throw new Error("Geçersiz kaynak JSON formatı (V2). 'dexie' formatı ve beklenen 'data' yapısı bulunamadı.");
            }
            const tableArray = sourceData.data.data;
            const charactersTable = tableArray.find(table => table.tableName === "characters");
            const threadsTable = tableArray.find(table => table.tableName === "threads");
            const messagesTable = tableArray.find(table => table.tableName === "messages");
            if (!charactersTable || !Array.isArray(charactersTable.rows)) {
                throw new Error("Kaynak JSON içinde 'characters' tablosu veya satırları bulunamadı (V2).");
            }
            const hasMessages = messagesTable && Array.isArray(messagesTable.rows);
            const hasThreads = threadsTable && Array.isArray(threadsTable.rows);

            const targetCharacters = [];
            const chatHistories = {};

            charactersTable.rows.forEach(sourceChar => {
                 if (!sourceChar || !sourceChar.name) {
                     console.warn("İsimsiz veya geçersiz kaynak karakter verisi atlandı (V2):", sourceChar);
                     return;
                 }
                const newCharId = generateId(); // Generate new ID for target character

                // Character Mapping (same as script_v2.js)
                const targetChar = {
                    id: newCharId,
                    name: sourceChar.name || "İsimsiz Karakter",
                    // ... (all other fields from script_v2.js map) ...
                    avatar: sourceChar.avatar?.url || '',
                    description: sourceChar.roleInstruction || '',
                    initialMessage: (sourceChar.initialMessages || []) .map(msg => msg?.content ? `[AI]: ${msg.content.trim()}` : null) .filter(Boolean) .join('\n'),
                    provider: 'openrouter', model: sourceChar.modelName || '',
                    reminderNote: sourceChar.reminderMessage || '',
                    generalInstructions: sourceChar.generalWritingInstructions && !sourceChar.generalWritingInstructions.startsWith('@') ? sourceChar.generalWritingInstructions : '',
                    inputPlaceholder: sourceChar.messageInputPlaceholder || '',
                    strictLength: (() => { const count = sourceChar.maxParagraphCountPerMessage; if (count === 1) return '1'; if (count === 2) return '2'; if (count && count > 2) return '3'; return ''; })(),
                    avatarSize: String(sourceChar.avatar?.size || ''),
                    avatarShape: sourceChar.avatar?.shape === 'square' ? 'square' : 'round',
                    overrideUserName: '', overrideUserAvatar: '', overrideUserDesc: '', roleplayStyle: 'default', userAvatarSize: '', userAvatarShape: 'default',
                    messageStyle: sourceChar.messageWrapperStyle || '', backgroundUrl: sourceChar.scene?.background?.url || '', audioUrl: sourceChar.scene?.music?.url || '',
                    imgPromptStart: sourceChar.imagePromptPrefix || '', imgPromptEnd: sourceChar.imagePromptSuffix || '', imgTriggers: sourceChar.imagePromptTriggers || '',
                    lorebooks: (sourceChar.loreBookUrls || []).join('\n'),
                    contextMethod: sourceChar.fitMessagesInContextMethod === 'truncate' ? 'truncate' : 'summarize',
                    extendedMemory: 'disabled', shortcuts: '', customJs: sourceChar.customCode || '',
                    socialTitle: sourceChar.metaTitle || '', socialDesc: sourceChar.metaDescription || '', socialImage: sourceChar.metaImage || '',
                };
                 if (!targetChar.model) console.warn(`'${targetChar.name}' için model adı bulunamadı (V2).`);
                targetCharacters.push(targetChar);

                // History Processing (same as script_v2.js)
                 if (hasMessages && hasThreads && sourceChar.id != null) {
                    const sourceThread = threadsTable.rows.find(t => t.characterId === sourceChar.id);
                    if (sourceThread && sourceThread.id != null) {
                        const sourceThreadId = sourceThread.id;
                        const history = messagesTable.rows
                            .filter(msg => msg.threadId === sourceThreadId)
                            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                            .map(sourceMsg => ({
                                role: sourceMsg.characterId === -1 ? 'user' : 'assistant',
                                content: sourceMsg.message || ''
                            }))
                            .filter((msg, index, arr) => !(index === 0 && msg.role === 'assistant' && targetChar.initialMessage.includes(msg.content)));
                        if (history.length > 0) {
                            chatHistories[newCharId] = history; // Use NEW ID
                        }
                    }
                 }
            });

            const targetData = {
                version: 2,
                type: "AIChatCharacterAndHistoryData",
                characters: targetCharacters,
                chatHistories: chatHistories
            };
            return JSON.stringify(targetData, null, 2);
        } catch (error) {
             console.error("Dönüştürme sırasında hata oluştu (V2 -> AIChat):", error);
             throw error;
        }
    }

    // --- Conversion Function 3: AIChat -> Perchance Dexie ---
    function convertAIToP(sourceJsonString) {
         try {
            const sourceData = JSON.parse(sourceJsonString);
            // Validation (same as rescript.js)
             if (!sourceData || (sourceData.type !== "AIChatCharacterData" && sourceData.type !== "AIChatCharacterAndHistoryData") || !Array.isArray(sourceData.characters)) {
                throw new Error("Geçersiz kaynak JSON formatı. 'AIChatCharacterData' veya 'AIChatCharacterAndHistoryData' tipi ve 'characters' dizisi bulunamadı.");
            }
            const isV2 = sourceData.type === "AIChatCharacterAndHistoryData" && typeof sourceData.chatHistories === 'object';

            // Reset Dexie ID counters FOR EACH CONVERSION
            nextCharacterId = 0;
            nextThreadId = 0;
            nextMessageId = 0;

            // Target Structure Initialization (same as rescript.js)
            const targetData = {
                formatName: "dexie", formatVersion: 1,
                data: {
                    databaseName: "chatbot-ui-v1", databaseVersion: 90.1,
                    tables: [ // Schema definitions
                        { name: "characters", schema: "++id,modelName,fitMessagesInContextMethod,uuid,creationTime,lastMessageTime,folderPath", rowCount: 0 },
                        { name: "threads", schema: "++id,name,characterId,creationTime,lastMessageTime,lastViewTime,folderPath", rowCount: 0 },
                        { name: "messages", schema: "++id,threadId,characterId,creationTime,order", rowCount: 0 },
                        { name: "misc", schema: "key", rowCount: 0 }, { name: "summaries", schema: "hash,threadId", rowCount: 0 },
                        { name: "memories", schema: "++id,[summaryHash+threadId],[characterId+status],[threadId+status],[threadId+index],threadId", rowCount: 0 },
                        { name: "lore", schema: "++id,bookId,bookUrl", rowCount: 0 }, { name: "textEmbeddingCache", schema: "++id,textHash,&[textHash+modelName]", rowCount: 0 },
                        { name: "textCompressionCache", schema: "++id,uncompressedTextHash,&[uncompressedTextHash+modelName+tokenLimit]", rowCount: 0 }
                    ],
                    data: [] // Data tables go here
                }
            };

            const characterRows = [];
            const threadRows = [];
            const messageRows = [];
            const sourceIdToDexieIdMap = {}; // AI Chat ID -> Dexie ID mapping
            const currentTime = generateTimestamp();

            // Character Processing (same as rescript.js)
            sourceData.characters.forEach(sourceChar => {
                if (!sourceChar || !sourceChar.id || !sourceChar.name) {
                     console.warn("ID veya isim içermeyen kaynak karakter verisi atlandı (AIChat -> P):", sourceChar);
                     return;
                 }
                const dexieCharId = nextCharacterId++;
                sourceIdToDexieIdMap[sourceChar.id] = dexieCharId;

                // Initial message parsing
                 const initialMessages = [];
                if (sourceChar.initialMessage) {
                    sourceChar.initialMessage.split('\n').forEach(line => {
                        const match = line.match(/^\[AI\]:\s*(.*)/);
                        if (match && match[1]) initialMessages.push({ author: 'ai', content: match[1].trim() });
                        else if (line.trim()) initialMessages.push({ author: 'ai', content: line.trim() }); // Default to AI
                    });
                 }
                 // strictLength to maxParagraphCount
                 let maxParagraphCount = 0;
                 if (sourceChar.strictLength === '1') maxParagraphCount = 1; else if (sourceChar.strictLength === '2') maxParagraphCount = 2; else if (sourceChar.strictLength === '3') maxParagraphCount = 3;

                // Dexie Character Object Mapping (same extensive mapping as rescript.js)
                const dexieChar = {
                    id: dexieCharId, name: sourceChar.name || "İsimsiz Karakter",
                    roleInstruction: sourceChar.description || '', modelName: sourceChar.model || 'perchance-ai',
                    fitMessagesInContextMethod: sourceChar.contextMethod === 'truncate' ? 'truncate' : 'summarizeOld',
                    uuid: null, creationTime: currentTime, lastMessageTime: currentTime, folderPath: "",
                    maxParagraphCountPerMessage: maxParagraphCount, reminderMessage: sourceChar.reminderNote || '',
                    generalWritingInstructions: (sourceChar.generalInstructions || '').startsWith('@') ? sourceChar.generalInstructions : sourceChar.generalInstructions,
                    messageWrapperStyle: sourceChar.messageStyle || '', imagePromptPrefix: sourceChar.imgPromptStart || '',
                    imagePromptSuffix: sourceChar.imgPromptEnd || '', imagePromptTriggers: sourceChar.imgTriggers || '',
                    customCode: sourceChar.customJs || '', messageInputPlaceholder: sourceChar.inputPlaceholder || '',
                    metaTitle: sourceChar.socialTitle || '', metaDescription: sourceChar.socialDesc || '', metaImage: sourceChar.socialImage || '',
                    temperature: 0.8, maxTokensPerMessage: 500, textEmbeddingModelName: "Xenova/bge-base-en-v1.5",
                    initialMessages: initialMessages, shortcutButtons: [],
                    loreBookUrls: (sourceChar.lorebooks || '').split('\n').filter(Boolean),
                    avatar: { url: sourceChar.avatar || '', size: parseInt(sourceChar.avatarSize, 10) || 6, shape: sourceChar.avatarShape === 'square' ? 'square' : 'round' },
                    scene: { background: { url: sourceChar.backgroundUrl || '' }, music: { url: sourceChar.audioUrl || '' } },
                    userCharacter: { avatar: {} }, systemCharacter: { avatar: {} }, streamingResponse: true, customData: {},
                    autoGenerateMemories: "none", userMessagesSentHistory:[], currentSummaryHashChain: [],
                    "$types": { "maxParagraphCountPerMessage": "undef", "initialMessages": "arrayNonindexKeys", "shortcutButtons": "arrayNonindexKeys", "loreBookUrls": "arrayNonindexKeys", "userMessagesSentHistory":"arrayNonindexKeys", "currentSummaryHashChain":"arrayNonindexKeys" }
                 };
                characterRows.push(dexieChar);
            });

            // History Processing (if V2 - same as rescript.js)
             if (isV2 && sourceData.chatHistories) {
                Object.entries(sourceData.chatHistories).forEach(([sourceCharId, history]) => {
                    const dexieCharId = sourceIdToDexieIdMap[sourceCharId];
                     if (dexieCharId === undefined || !Array.isArray(history) || history.length === 0) {
                         console.warn(`Karakter ID ${sourceCharId} için Dexie ID bulunamadı veya geçmiş boş/geçersiz, atlanıyor (AIChat -> P).`);
                         return;
                     }
                    const dexieThreadId = nextThreadId++;
                    const threadCreationTime = generateTimestamp();
                    let lastMsgTime = threadCreationTime;

                    // Create Thread Row (with defaults from rescript.js)
                    const dexieThread = {
                        id: dexieThreadId, name: characterRows.find(c=>c.id===dexieCharId)?.name || "İçe Aktarılan Sohbet",
                        characterId: dexieCharId, creationTime: threadCreationTime, lastMessageTime: threadCreationTime, // Updated later
                        lastViewTime: threadCreationTime, folderPath: "", isFav: false, userCharacter: { avatar: {} },
                        systemCharacter: { avatar: {} }, character: { avatar: {} },
                        modelName: characterRows.find(c=>c.id===dexieCharId)?.modelName || 'perchance-ai',
                        customCodeWindow: { visible: false, width: null }, customData: {}, loreBookId: null,
                        textEmbeddingModelName: "Xenova/bge-base-en-v1.5", userMessagesSentHistory: [], unsentMessageText: "",
                        shortcutButtons: [ // Default shortcuts
                             {"name":"🗣️ {{char}}","message":"/ai <optional writing instruction>","insertionType":"replace","autoSend":false,"type":"message"}, {"name":"🗣️ {{user}}","message":"/user <optional writing instruction>","insertionType":"replace","autoSend":false,"type":"message"},
                             {"name":"🗣️ Narrator","message":"/nar <optional writing instruction>","insertionType":"replace","autoSend":false,"type":"message"}, {"name":"🖼️ Image","message":"/image --num=3","insertionType":"replace","autoSend":true,"type":"message"}
                        ],
                        currentSummaryHashChain: [], "$types": { "userMessagesSentHistory": "arrayNonindexKeys", "shortcutButtons": "arrayNonindexKeys", "currentSummaryHashChain": "arrayNonindexKeys" }
                     };
                    threadRows.push(dexieThread);

                    // Create Message Rows (same as rescript.js)
                    history.forEach((message, index) => {
                         if (!message || typeof message.content !== 'string' || (message.role !== 'user' && message.role !== 'assistant')) {
                           console.warn("Geçersiz mesaj formatı atlandı (AIChat -> P):", message); return;
                         }
                        const msgTime = lastMsgTime + (index + 1) * 10; lastMsgTime = msgTime;
                        const dexieMessage = {
                            id: nextMessageId++, threadId: dexieThreadId,
                            characterId: message.role === 'user' ? -1 : dexieCharId,
                            message: message.content, order: index, creationTime: msgTime,
                             // Other default fields from rescript.js
                            hiddenFrom: [], expectsReply: 0, variants: [null], memoryIdBatchesUsed: [], loreIdsUsed: [],
                            summaryHashUsed: null, summariesUsed: null, summariesEndingHere: null, memoriesEndingHere: null,
                            memoryQueriesUsed: [], messageIdsUsed: [], name: null, scene: null, avatar: {}, customData: {},
                            wrapperStyle: "", instruction: null,
                            "$types": { "hiddenFrom": "arrayNonindexKeys", "expectsReply": "undef", "variants": "arrayNonindexKeys", "memoryIdBatchesUsed": "arrayNonindexKeys", "loreIdsUsed": "arrayNonindexKeys", "memoryQueriesUsed": "arrayNonindexKeys", "messageIdsUsed": "arrayNonindexKeys" }
                         };
                        messageRows.push(dexieMessage);
                    });
                    dexieThread.lastMessageTime = lastMsgTime; // Update thread's last message time
                });
             }

            // Populate Data Section (same as rescript.js)
            targetData.data.data = [
                { tableName: "characters", inbound: true, rows: characterRows },
                { tableName: "threads", inbound: true, rows: threadRows },
                { tableName: "messages", inbound: true, rows: messageRows },
                { tableName: "misc", inbound: true, rows: [] }, { tableName: "summaries", inbound: true, rows: [] },
                { tableName: "memories", inbound: true, rows: [] }, { tableName: "lore", inbound: true, rows: [] },
                { tableName: "textEmbeddingCache", inbound: true, rows: [] }, { tableName: "textCompressionCache", inbound: true, rows: [] }
            ];

            // Update Row Counts (same as rescript.js)
             targetData.data.tables.find(t => t.name === 'characters').rowCount = characterRows.length;
             targetData.data.tables.find(t => t.name === 'threads').rowCount = threadRows.length;
             targetData.data.tables.find(t => t.name === 'messages').rowCount = messageRows.length;

            return JSON.stringify(targetData, null, 2); // Pretty print
        } catch (error) {
            console.error("Dönüştürme sırasında hata oluştu (AIChat -> Perchance):", error);
            throw error;
        }
    }


    // --- UI Interaction Functions ---

    function showConverter(targetId) {
        converterState.activeConverterId = targetId;
        converterState.convertedJsonData = null; // Reset data when switching

        navButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.target === targetId);
        });

        converterSections.forEach(section => {
            section.classList.toggle('active', section.id === targetId);
            // Reset status and hide download button in all sections
            const id = section.id;
            if (elements[id]) {
                elements[id].statusDiv.textContent = '';
                elements[id].statusDiv.className = 'status';
                elements[id].downloadBtn.style.display = 'none';
                elements[id].downloadBtn.disabled = true;
                 // Clear file input value if needed (optional, helps re-selecting same file)
                 if (elements[id].fileInput) elements[id].fileInput.value = null;
            }
        });
    }

    function handleFile(file, converterId) {
        const ui = elements[converterId];
        if (!ui) {
            console.error("Invalid converter ID passed to handleFile:", converterId);
            return;
        }

        // Reset UI for this specific converter
        ui.statusDiv.textContent = 'Dosya okunuyor...';
        ui.statusDiv.className = 'status';
        ui.downloadBtn.style.display = 'none';
        ui.downloadBtn.disabled = true;
        converterState.convertedJsonData = null; // Clear previous data for this converter type

        if (!file || !file.type.match('application/json')) {
            ui.statusDiv.textContent = 'Hata: Lütfen geçerli bir JSON dosyası seçin.';
            ui.statusDiv.className = 'status error';
            return;
        }

        // Store potential filenames
        const filenameBase = file.name.replace(/\.json$/i, '');
        converterState.sourceFilename = filenameBase || ui.defaultFilenameBase;
        converterState.downloadFilename = `${converterState.sourceFilename}${ui.downloadSuffix}`;

        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                ui.statusDiv.textContent = 'Dönüştürülüyor...';
                const fileContent = e.target.result;
                // Call the appropriate conversion function assigned to this section
                const resultJson = ui.converterFunc(fileContent);

                if (resultJson) {
                    converterState.convertedJsonData = resultJson; // Store result in global state

                    // Update status based on result (example counts)
                    let successMsg = 'Dosya başarıyla dönüştürüldü!';
                    try { // Safely parse result for counts
                        const parsedResult = JSON.parse(resultJson);
                        if (converterId.endsWith('-ai')) { // Perchance -> AIChat
                            const charCount = parsedResult.characters?.length || 0;
                            let historyCount = 0;
                            if (converterId === 'converter-p2-ai' && parsedResult.chatHistories) {
                                historyCount = Object.keys(parsedResult.chatHistories).length;
                            }
                            successMsg = `Başarılı! (${charCount} karakter${historyCount > 0 ? ` ve ${historyCount} sohbet geçmişi` : ''} bulundu)`;
                        } else { // AIChat -> Perchance
                            const charCount = parsedResult.data?.tables?.find(t => t.name === 'characters')?.rowCount || 0;
                            const threadCount = parsedResult.data?.tables?.find(t => t.name === 'threads')?.rowCount || 0;
                             successMsg = `Başarılı! (${charCount} karakter${threadCount > 0 ? ` ve ${threadCount} sohbet` : ''} Perchance formatına aktarıldı)`;
                        }
                    } catch (parseError) { /* Use default success message */ }

                    ui.statusDiv.textContent = successMsg;
                    ui.statusDiv.className = 'status success';
                    ui.downloadBtn.style.display = 'inline-block';
                    ui.downloadBtn.disabled = false;
                } else {
                    // Should not happen if converterFunc throws errors correctly
                    ui.statusDiv.textContent = 'Hata: Dönüştürme bilinmeyen bir nedenle başarısız oldu.';
                    ui.statusDiv.className = 'status error';
                }
            } catch (error) {
                // Catch errors thrown by converterFunc or JSON.parse
                ui.statusDiv.textContent = `Hata: ${error.message}`;
                ui.statusDiv.className = 'status error';
                console.error(`İşleme hatası (${converterId}):`, error);
            }
        };

        reader.onerror = function() {
            ui.statusDiv.textContent = 'Hata: Dosya okunurken bir hata oluştu.';
            ui.statusDiv.className = 'status error';
        };

        reader.readAsText(file);
    }

    // --- Event Listeners Setup ---

    // Navigation Button Listeners
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            showConverter(button.dataset.target);
        });
    });

    // Setup listeners for each converter section
    Object.keys(elements).forEach(converterId => {
        const ui = elements[converterId];

        // Drag and Drop Listeners
        ui.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault(); e.stopPropagation(); ui.dropZone.classList.add('drag-over');
        });
        ui.dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault(); e.stopPropagation(); ui.dropZone.classList.remove('drag-over');
        });
        ui.dropZone.addEventListener('drop', (e) => {
            e.preventDefault(); e.stopPropagation(); ui.dropZone.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFile(files[0], converterId); // Pass converter ID
            }
        });

        // Click to Select File Listener
        ui.dropZone.addEventListener('click', () => {
            ui.fileInput.click();
        });

        // File Input Change Listener
        ui.fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                handleFile(files[0], converterId); // Pass converter ID
            }
             ui.fileInput.value = null; // Reset input to allow re-selecting same file
        });

        // Download Button Listener
        ui.downloadBtn.addEventListener('click', () => {
            // Only download if the button belongs to the active converter
            // and data exists for the *current* active conversion
            if (converterState.activeConverterId === converterId && converterState.convertedJsonData) {
                const blob = new Blob([converterState.convertedJsonData], { type: 'application/json;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = converterState.downloadFilename; // Use filename from state
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                ui.statusDiv.textContent = 'Dönüştürülmüş dosya indirildi!';
                ui.statusDiv.className = 'status success';
            } else {
                 console.warn("Download clicked for inactive/invalid state or wrong converter.");
                 ui.statusDiv.textContent = 'İndirme hatası: Lütfen dosyayı tekrar dönüştürün.';
                 ui.statusDiv.className = 'status error';
                 ui.downloadBtn.style.display = 'none';
                 ui.downloadBtn.disabled = true;
            }
        });
    });

    // --- Initial State ---
    // Show the first converter by default, or none if preferred
    if (navButtons.length > 0) {
       showConverter(navButtons[0].dataset.target); // Activate the first button's target
    }

});