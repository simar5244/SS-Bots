#!/usr/bin/env node

/**
 * Convert SVG to ICO format
 * Uses sharp library to create multi-resolution ICO file
 */

const fs = require('fs');
const path = require('path');

async function convertSvgToIco() {
  try {
    // Try to use sharp if available
    const sharp = require('sharp');
    
    const svgPath = path.join(__dirname, 'icon.svg');
    const icoPath = path.join(__dirname, 'icon.ico');
    const pngPath = path.join(__dirname, 'icon.png');
    
    console.log('Converting SVG to ICO...');
    
    // First convert to PNG at high resolution
    await sharp(svgPath)
      .resize(256, 256)
      .png()
      .toFile(pngPath);
    
    console.log('✓ Created PNG icon');
    
    // For ICO, we'll create multiple sizes and combine them
    const sizes = [16, 32, 48, 64, 128, 256];
    const pngBuffers = [];
    
    for (const size of sizes) {
      const buffer = await sharp(svgPath)
        .resize(size, size)
        .png()
        .toBuffer();
      pngBuffers.push(buffer);
    }
    
    // Create ICO file manually (ICO format header + PNG images)
    const icoHeader = Buffer.alloc(6);
    icoHeader.writeUInt16LE(0, 0); // Reserved
    icoHeader.writeUInt16LE(1, 2); // Type (1 = ICO)
    icoHeader.writeUInt16LE(sizes.length, 4); // Number of images
    
    const iconDirEntries = [];
    let imageDataOffset = 6 + (sizes.length * 16); // Header + directory entries
    
    for (let i = 0; i < sizes.length; i++) {
      const size = sizes[i];
      const buffer = pngBuffers[i];
      
      const entry = Buffer.alloc(16);
      entry.writeUInt8(size === 256 ? 0 : size, 0); // Width (0 = 256)
      entry.writeUInt8(size === 256 ? 0 : size, 1); // Height (0 = 256)
      entry.writeUInt8(0, 2); // Color palette
      entry.writeUInt8(0, 3); // Reserved
      entry.writeUInt16LE(1, 4); // Color planes
      entry.writeUInt16LE(32, 6); // Bits per pixel
      entry.writeUInt32LE(buffer.length, 8); // Image size
      entry.writeUInt32LE(imageDataOffset, 12); // Image offset
      
      iconDirEntries.push(entry);
      imageDataOffset += buffer.length;
    }
    
    // Combine all parts
    const icoBuffer = Buffer.concat([
      icoHeader,
      ...iconDirEntries,
      ...pngBuffers
    ]);
    
    fs.writeFileSync(icoPath, icoBuffer);
    
    console.log('✓ Created ICO icon with multiple resolutions');
    console.log(`  Sizes: ${sizes.join(', ')} pixels`);
    console.log(`  Output: ${icoPath}`);
    
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log('⚠ Sharp not installed. Installing...');
      const { execSync } = require('child_process');
      execSync('npm install sharp --no-save', { stdio: 'inherit' });
      console.log('Retrying conversion...');
      await convertSvgToIco();
    } else {
      throw error;
    }
  }
}

convertSvgToIco().catch(console.error);
