class UIController {
    constructor(audioProcessor) {
        this.audioProcessor = audioProcessor;
        this.draggedIndex = null;
        
        this.initElements();
        this.initEventListeners();
    }

    initElements() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.fileList = document.getElementById('fileList');
        this.clearBtn = document.getElementById('clearBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.status = document.getElementById('status');
        this.statusText = document.getElementById('statusText');
        this.progress = document.getElementById('progress');
        this.progressBar = document.getElementById('progressBar');
    }

    initEventListeners() {
        // File upload events
        this.dropZone.addEventListener('click', () => this.fileInput.click());
        
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('dragover');
        });
        
        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('dragover');
        });
        
        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });
        
        this.fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Control buttons
        this.clearBtn.addEventListener('click', () => this.clearAll());
        this.exportBtn.addEventListener('click', () => this.exportFiles());
    }

    async handleFiles(files) {
        this.showStatus('Processing files...', 'normal');
        
        try {
            const loadedFiles = await this.audioProcessor.loadFiles(files);
            this.audioProcessor.addFiles(loadedFiles);
            this.renderFileList();
            this.updateExportButton();
            
            if (loadedFiles.length > 0) {
                this.showStatus(`Loaded ${loadedFiles.length} file(s)`, 'success');
            }
        } catch (error) {
            this.showStatus(error.message, 'error');
        }
    }

    renderFileList() {
        this.fileList.innerHTML = '';
        const files = this.audioProcessor.getFiles();
        
        files.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.draggable = true;
            item.dataset.index = index;
            
            item.innerHTML = `
                <span class="drag-handle">≡</span>
                <span class="file-name">${file.name}</span>
                <span class="file-duration">${this.audioProcessor.formatDuration(file.duration)}</span>
                <button class="remove-btn" data-index="${index}">×</button>
            `;
            
            this.fileList.appendChild(item);
        });
        
        this.setupDragAndDrop();
        this.setupRemoveButtons();
    }

    setupDragAndDrop() {
        document.querySelectorAll('.file-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                this.draggedIndex = parseInt(e.currentTarget.dataset.index);
                e.currentTarget.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', (e) => {
                e.currentTarget.classList.remove('dragging');
                document.querySelectorAll('.file-item').forEach(el => {
                    el.classList.remove('drag-over');
                });
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                const currentItem = e.currentTarget;
                const draggingItem = document.querySelector('.dragging');
                
                if (draggingItem && currentItem !== draggingItem) {
                    const rect = currentItem.getBoundingClientRect();
                    const midpoint = rect.top + rect.height / 2;
                    
                    if (e.clientY < midpoint) {
                        currentItem.classList.add('drag-over');
                    } else {
                        currentItem.classList.remove('drag-over');
                    }
                }
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const dropIndex = parseInt(e.currentTarget.dataset.index);
                
                if (this.draggedIndex !== null && this.draggedIndex !== dropIndex) {
                    this.audioProcessor.reorderFiles(this.draggedIndex, dropIndex);
                    this.renderFileList();
                }
            });

            item.addEventListener('dragleave', (e) => {
                e.currentTarget.classList.remove('drag-over');
            });
        });
    }

    setupRemoveButtons() {
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(e.currentTarget.dataset.index);
                this.audioProcessor.removeFile(index);
                this.renderFileList();
                this.updateExportButton();
                
                if (this.audioProcessor.getFiles().length === 0) {
                    this.showStatus('All files removed', 'normal');
                }
            });
        });
    }

    clearAll() {
        this.audioProcessor.clearAll();
        this.renderFileList();
        this.updateExportButton();
        this.showStatus('All files cleared', 'normal');
    }

    async exportFiles() {
        if (this.audioProcessor.getFiles().length === 0) return;
        
        this.exportBtn.disabled = true;
        this.showStatus('Exporting...', 'normal');
        this.progress.style.display = 'block';
        this.progressBar.style.width = '0%';
        
        try {
            // Merge files
            const { outputBuffer, cuePoints } = await this.audioProcessor.mergeFiles((progress) => {
                this.progressBar.style.width = `${progress}%`;
            });
            
            // Encode to WAV
            this.progressBar.style.width = '60%';
            const wavBlob = WavEncoder.encodeWAV(outputBuffer, cuePoints);
            
            // Download
            this.progressBar.style.width = '100%';
            this.downloadFile(wavBlob, 'merged_audio.wav');
            
            this.showStatus('Export complete!', 'success');
            setTimeout(() => {
                this.progress.style.display = 'none';
            }, 1000);
            
        } catch (error) {
            console.error('Export error:', error);
            this.showStatus(`Export failed: ${error.message}`, 'error');
            this.progress.style.display = 'none';
        } finally {
            this.exportBtn.disabled = this.audioProcessor.getFiles().length === 0;
        }
    }

    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        document.body.appendChild(a);
        a.href = url;
        a.download = filename;
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    updateExportButton() {
        this.exportBtn.disabled = this.audioProcessor.getFiles().length === 0;
    }

    showStatus(message, type = 'normal') {
        this.statusText.textContent = message;
        this.status.className = 'status show';
        if (type === 'error') this.status.classList.add('error');
        if (type === 'success') this.status.classList.add('success');
        
        if (type !== 'normal') {
            setTimeout(() => {
                this.status.classList.remove('show');
            }, 3000);
        }
    }
}