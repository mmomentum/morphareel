class WavEncoder {
    static encodeWAV(audioBuffer, cuePoints) {
        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        const bitsPerSample = 32;
        const bytesPerSample = bitsPerSample / 8;
        
        // Calculate sizes
        const dataSize = length * numChannels * bytesPerSample;
        
        // Create cue chunk if there are cue points
        let cueChunkSize = 0;
        let listChunkSize = 0;
        
        if (cuePoints.length > 0) {
            // Cue chunk size: 4 bytes for count + 24 bytes per cue point
            cueChunkSize = 4 + (cuePoints.length * 24);
            
            // Calculate LIST chunk size for labels
            listChunkSize = 4; // 'adtl'
            for (let i = 0; i < cuePoints.length; i++) {
                const labelText = cuePoints[i].label || `Cue ${i + 1}`;
                const labelLength = labelText.length + 1; // +1 for null terminator
                const chunkLength = 4 + labelLength + (labelLength % 2); // Pad to even
                listChunkSize += 8 + chunkLength; // 8 for 'labl' + size field
            }
        }
        
        // Calculate total file size
        let totalSize = 44 + dataSize; // Basic WAV size
        if (cueChunkSize > 0) {
            totalSize += 8 + cueChunkSize; // Cue chunk
            totalSize += 8 + listChunkSize; // LIST chunk
        }
        
        const buffer = new ArrayBuffer(totalSize);
        const view = new DataView(buffer);
        
        // Helper function to write string
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        // Write RIFF header
        writeString(0, 'RIFF');
        view.setUint32(4, totalSize - 8, true);
        writeString(8, 'WAVE');
        
        // Write fmt chunk
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true); // Format chunk size
        view.setUint16(20, 3, true); // Format (3 = IEEE float)
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
        view.setUint16(32, numChannels * bytesPerSample, true);
        view.setUint16(34, bitsPerSample, true);
        
        let offset = 36;
        
        // Write cue chunk if there are cue points
        if (cuePoints.length > 0) {
            // Write cue chunk header
            writeString(offset, 'cue ');
            view.setUint32(offset + 4, cueChunkSize, true);
            offset += 8;
            
            // Write number of cue points
            view.setUint32(offset, cuePoints.length, true);
            offset += 4;
            
            // Write each cue point
            for (let i = 0; i < cuePoints.length; i++) {
                view.setUint32(offset, i + 1, true); // dwIdentifier: Cue ID (1-based)
                offset += 4;
                view.setUint32(offset, cuePoints[i].position, true); // dwPosition: same as sample offset for compatibility
                offset += 4;
                writeString(offset, 'data'); // fccChunk: Chunk ID
                offset += 4;
                view.setUint32(offset, 0, true); // dwChunkStart: Chunk start (0 for data chunk)
                offset += 4;
                view.setUint32(offset, 0, true); // dwBlockStart: Block start (0 for PCM)
                offset += 4;
                view.setUint32(offset, cuePoints[i].position, true); // dwSampleOffset: Sample offset
                offset += 4;
            }
            
            // Write LIST chunk with labels
            writeString(offset, 'LIST');
            view.setUint32(offset + 4, listChunkSize, true);
            offset += 8;
            
            writeString(offset, 'adtl');
            offset += 4;
            
            // Write labels for each cue point
            for (let i = 0; i < cuePoints.length; i++) {
                writeString(offset, 'labl');
                offset += 4;
                
                const labelText = cuePoints[i].label || `Cue ${i + 1}`;
                const labelLength = labelText.length + 1;
                const chunkLength = 4 + labelLength + (labelLength % 2); // Pad to even
                
                view.setUint32(offset, chunkLength, true);
                offset += 4;
                
                view.setUint32(offset, i + 1, true); // Cue ID reference
                offset += 4;
                
                // Write label text
                writeString(offset, labelText);
                offset += labelText.length;
                
                // Write null terminator
                view.setUint8(offset, 0);
                offset += 1;
                
                // Pad to even byte boundary if necessary
                if (labelLength % 2 === 1) {
                    view.setUint8(offset, 0);
                    offset += 1;
                }
            }
        }
        
        // Write data chunk
        writeString(offset, 'data');
        view.setUint32(offset + 4, dataSize, true);
        offset += 8;
        
        // Write audio data as 32-bit float
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                const sample = audioBuffer.getChannelData(channel)[i];
                view.setFloat32(offset, sample, true);
                offset += 4;
            }
        }
        
        return new Blob([buffer], { type: 'audio/wav' });
    }
}