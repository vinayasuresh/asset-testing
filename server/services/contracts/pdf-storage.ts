/**
 * Contract PDF Storage
 *
 * Manages storage and retrieval of contract PDF files
 * Organizes by tenant for multi-tenancy support
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { existsSync } from 'fs';

export interface StoredContractInfo {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Contract PDF Storage Service
 */
export class ContractPDFStorage {
  private baseDir: string;
  private resolvedBaseDir: string;

  constructor(baseDir: string = './data/contracts') {
    this.baseDir = baseDir;
    // Resolve the base directory to an absolute path for security validation
    this.resolvedBaseDir = path.resolve(baseDir);
  }

  /**
   * Validate and sanitize a path to prevent path traversal attacks
   * @param relativePath - The relative path to validate
   * @returns The validated absolute path
   * @throws Error if path traversal is detected
   */
  private validatePath(relativePath: string): string {
    // Remove any null bytes (common attack vector)
    const sanitizedPath = relativePath.replace(/\0/g, '');

    // Resolve the full path
    const dataDir = path.resolve(this.baseDir, '..');
    const fullPath = path.resolve(dataDir, sanitizedPath);

    // Ensure the resolved path is within the allowed directory
    const allowedDir = path.resolve(dataDir, 'contracts');
    if (!fullPath.startsWith(allowedDir + path.sep) && fullPath !== allowedDir) {
      console.error(`[PDF Storage] Path traversal attempt blocked: ${relativePath}`);
      throw new Error('Invalid file path: Access denied');
    }

    return fullPath;
  }

  /**
   * Validate tenant ID to prevent directory traversal
   */
  private validateTenantId(tenantId: string): void {
    // Tenant ID should only contain alphanumeric characters, hyphens, and underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(tenantId)) {
      throw new Error('Invalid tenant ID format');
    }
  }

  /**
   * Validate contract ID to prevent directory traversal
   */
  private validateContractId(contractId: string): void {
    // Contract ID should only contain alphanumeric characters, hyphens, and underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(contractId)) {
      throw new Error('Invalid contract ID format');
    }
  }

  /**
   * Store uploaded PDF contract
   */
  async storeContract(
    fileBuffer: Buffer,
    originalFileName: string,
    tenantId: string,
    contractId: string
  ): Promise<StoredContractInfo> {
    // Validate inputs to prevent path traversal
    this.validateTenantId(tenantId);
    this.validateContractId(contractId);

    // Validate file extension
    const ext = path.extname(originalFileName).toLowerCase();
    if (ext !== '.pdf') {
      throw new Error('Only PDF files are allowed');
    }

    // Create tenant directory
    const tenantDir = path.join(this.baseDir, tenantId);
    await fs.mkdir(tenantDir, { recursive: true });

    // Generate unique file name with sanitized components
    const fileId = uuidv4();
    const storedFileName = `${contractId}_${fileId}.pdf`;
    const filePath = path.join(tenantDir, storedFileName);

    // Write file
    await fs.writeFile(filePath, fileBuffer);

    console.log(`[PDF Storage] Stored contract: ${filePath}`);

    // Return relative path
    const relativePath = `contracts/${tenantId}/${storedFileName}`;

    return {
      filePath: relativePath,
      fileName: storedFileName,
      fileSize: fileBuffer.length,
      mimeType: 'application/pdf'
    };
  }

  /**
   * Retrieve contract PDF
   */
  async getContract(relativePath: string): Promise<Buffer> {
    // Validate path to prevent directory traversal
    const fullPath = this.validatePath(relativePath);

    if (!existsSync(fullPath)) {
      throw new Error('Contract file not found');
    }

    return await fs.readFile(fullPath);
  }

  /**
   * Check if contract exists
   */
  async contractExists(relativePath: string): Promise<boolean> {
    try {
      // Validate path to prevent directory traversal
      const fullPath = this.validatePath(relativePath);
      return existsSync(fullPath);
    } catch {
      // If path validation fails, the file doesn't exist (from security perspective)
      return false;
    }
  }

  /**
   * Delete contract PDF
   */
  async deleteContract(relativePath: string): Promise<void> {
    // Validate path to prevent directory traversal
    const fullPath = this.validatePath(relativePath);

    if (existsSync(fullPath)) {
      await fs.unlink(fullPath);
      console.log(`[PDF Storage] Deleted contract: ${fullPath}`);
    } else {
      console.warn(`[PDF Storage] Contract not found for deletion: ${relativePath}`);
    }
  }

  /**
   * Get contract file size
   */
  async getContractSize(relativePath: string): Promise<number> {
    // Validate path to prevent directory traversal
    const fullPath = this.validatePath(relativePath);

    if (!existsSync(fullPath)) {
      throw new Error('Contract file not found');
    }

    const stats = await fs.stat(fullPath);
    return stats.size;
  }

  /**
   * List all contracts for a tenant
   */
  async listTenantContracts(tenantId: string): Promise<string[]> {
    // Validate tenant ID to prevent directory traversal
    this.validateTenantId(tenantId);

    const tenantDir = path.join(this.baseDir, tenantId);

    if (!existsSync(tenantDir)) {
      return [];
    }

    const files = await fs.readdir(tenantDir);
    return files
      .filter(file => file.endsWith('.pdf')) // Only return PDF files
      .map(file => `contracts/${tenantId}/${file}`);
  }

  /**
   * Clean up old or orphaned contract files
   */
  async cleanupOrphanedFiles(tenantId: string, validContractIds: string[]): Promise<number> {
    // Validate tenant ID to prevent directory traversal
    this.validateTenantId(tenantId);

    const tenantDir = path.join(this.baseDir, tenantId);

    if (!existsSync(tenantDir)) {
      return 0;
    }

    const files = await fs.readdir(tenantDir);
    let deletedCount = 0;

    for (const file of files) {
      // Only process PDF files
      if (!file.endsWith('.pdf')) continue;

      // Extract contract ID from filename (format: contractId_uuid.pdf)
      const contractId = file.split('_')[0];

      if (!validContractIds.includes(contractId)) {
        const filePath = path.join(tenantDir, file);
        await fs.unlink(filePath);
        deletedCount++;
        console.log(`[PDF Storage] Deleted orphaned file: ${file}`);
      }
    }

    return deletedCount;
  }
}
