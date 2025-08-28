class AudioProcessor {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
        this.audioFiles = [];
    }

    async loadFile(file) {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        
        return {
            name: file.name,
            buffer: audioBuffer,
            duration: audioBuffer.duration
        };
    }

    async loadFiles(files) {
        const results = [];
        
        for (let file of files) {
            if (file.type.startsWith('audio/')) {
                try {
                    const audioFile = await this.loadFile(file);
                    results.push(audioFile);
                } catch (error) {
                    console.error(`Error loading ${file.name}:`, error);
                    throw new Error(`Failed to load ${file.name}: ${error.message}`);
                }
            }
        }
        
        return results;
    }

    addFiles(newFiles) {
        this.audioFiles.push(...newFiles);
    }

    removeFile(index) {
        this.audioFiles.splice(index, 1);
    }

    reorderFiles(fromIndex, toIndex) {
        const file = this.audioFiles[fromIndex];
        this.audioFiles.splice(fromIndex, 1);
        
        if (toIndex > fromIndex) {
            this.audioFiles.splice(toIndex - 1, 0, file);
        } else {
            this.audioFiles.splice(toIndex, 0, file);
        }
    }

    clearAll() {
        this.audioFiles = [];
    }

    getFiles() {
        return this.audioFiles;
    }

    async mergeFiles(progressCallback) {
        if (this.audioFiles.length === 0) {
            throw new Error('No audio files to merge');
        }

        // Calculate total length and cue points
        let totalFrames = 0;
        const cuePoints = [];
        
        // Add cue point at the beginning
        cuePoints.push({
            position: 0,
            label: this.audioFiles[0].name.replace(/\.[^/.]+$/, '') // Remove extension
        });
        
        for (let i = 0; i < this.audioFiles.length; i++) {
            if (i > 0) {
                cuePoints.push({
                    position: totalFrames,
                    label: this.audioFiles[i].name.replace(/\.[^/.]+$/, '') // Remove extension
                });
            }
            totalFrames += this.audioFiles[i].buffer.length;
        }
        
        // Create output buffer (stereo, 48kHz)
        const outputBuffer = this.audioContext.createBuffer(2, totalFrames, 48000);
        
        // Copy audio data
        let currentFrame = 0;
        for (let i = 0; i < this.audioFiles.length; i++) {
            const sourceBuffer = this.audioFiles[i].buffer;
            
            for (let channel = 0; channel < 2; channel++) {
                const outputData = outputBuffer.getChannelData(channel);
                
                // Handle mono to stereo conversion
                let sourceData;
                if (sourceBuffer.numberOfChannels > channel) {
                    sourceData = sourceBuffer.getChannelData(channel);
                } else {
                    // Use first channel for both if mono
                    sourceData = sourceBuffer.getChannelData(0);
                }
                
                for (let j = 0; j < sourceBuffer.length; j++) {
                    outputData[currentFrame + j] = sourceData[j];
                }
            }
            
            currentFrame += sourceBuffer.length;
            
            if (progressCallback) {
                progressCallback((i + 1) / this.audioFiles.length * 50);
            }
        }
        
        return { outputBuffer, cuePoints };
    }

    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}