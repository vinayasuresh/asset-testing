import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const GEOGRAPHIC_DATA_CDN = 'https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json';

interface GeographicDataFiles {
  countries: string;
  states: string;
  cities: string;
}

const DATA_FILES: GeographicDataFiles = {
  countries: 'countries.json',
  states: 'states.json', 
  cities: 'cities.json'
};

/**
 * Downloads a file from a URL and saves it to the specified path
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`✓ Downloaded: ${path.basename(destPath)}`);
          resolve();
        });
      } else {
        fs.unlink(destPath, () => {});
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

/**
 * Checks if a file exists and has content (size > 0)
 */
function isValidFile(filePath: string): boolean {
  try {
    const stats = fs.statSync(filePath);
    return stats.isFile() && stats.size > 0;
  } catch {
    return false;
  }
}

/**
 * Ensures geographic data files exist, downloading them if necessary
 */
export async function ensureGeographicData(): Promise<void> {
  const dataDir = path.join(process.cwd(), 'server', 'data');
  
  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    console.log('Creating data directory...');
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const missingFiles: string[] = [];
  
  // Check which files are missing or empty
  for (const [key, filename] of Object.entries(DATA_FILES)) {
    const filePath = path.join(dataDir, filename);
    if (!isValidFile(filePath)) {
      missingFiles.push(key);
      console.log(`⚠️  Geographic data file missing or empty: ${filename}`);
    }
  }

  // If all files exist, we're done
  if (missingFiles.length === 0) {
    console.log('✓ All geographic data files present');
    return;
  }

  // Download missing files from CDN
  console.log(`Downloading ${missingFiles.length} geographic data file(s) from CDN...`);
  
  const downloadPromises = missingFiles.map(async (key) => {
    const filename = DATA_FILES[key as keyof GeographicDataFiles];
    const url = `${GEOGRAPHIC_DATA_CDN}/${filename}`;
    const destPath = path.join(dataDir, filename);
    
    try {
      await downloadFile(url, destPath);
    } catch (error) {
      console.error(`Failed to download ${filename}:`, error);
      throw error;
    }
  });

  try {
    await Promise.all(downloadPromises);
    console.log('✓ All geographic data files ready');
  } catch (error) {
    console.error('Failed to download geographic data:', error);
    throw new Error('Could not initialize geographic data. Application may not function correctly.');
  }
}
