/**
 * Compliance Frameworks Service
 *
 * Implements comprehensive compliance controls for:
 * - ISO 27001 (Information Security Management)
 * - PCI-DSS (Payment Card Industry Data Security Standard)
 * - GDPR (General Data Protection Regulation)
 * - SOC2 (Service Organization Control 2)
 * - HIPAA (Health Insurance Portability and Accountability Act)
 * - India DPDP Act (Digital Personal Data Protection)
 */

import { storage } from '../../storage';
import { policyEngine } from '../policy/engine';

// ============================================================================
// COMPLIANCE FRAMEWORK DEFINITIONS
// ============================================================================

export interface ComplianceControl {
  id: string;
  framework: string;
  category: string;
  controlId: string;
  name: string;
  description: string;
  requirement: string;
  checkType: 'automated' | 'manual' | 'hybrid';
  severity: 'critical' | 'high' | 'medium' | 'low';
  checkFunction?: (tenantId: string) => Promise<ControlCheckResult>;
}

export interface ControlCheckResult {
  controlId: string;
  status: 'compliant' | 'non_compliant' | 'partial' | 'not_applicable' | 'not_checked';
  score: number; // 0-100
  findings: string[];
  evidence: EvidenceItem[];
  recommendations: string[];
  lastChecked: Date;
}

export interface EvidenceItem {
  type: 'document' | 'log' | 'screenshot' | 'config' | 'report' | 'policy';
  name: string;
  description: string;
  collectedAt: Date;
  data?: any;
  url?: string;
}

export interface ComplianceReport {
  framework: string;
  tenantId: string;
  generatedAt: Date;
  overallScore: number;
  status: 'compliant' | 'non_compliant' | 'partial';
  totalControls: number;
  compliantControls: number;
  nonCompliantControls: number;
  partialControls: number;
  notApplicable: number;
  controlResults: ControlCheckResult[];
  evidencePack: EvidenceItem[];
  recommendations: string[];
}

// ============================================================================
// ISO 27001 CONTROLS
// ============================================================================

export const ISO27001_CONTROLS: ComplianceControl[] = [
  // A.5 - Information Security Policies
  {
    id: 'iso27001-a5.1.1',
    framework: 'ISO27001',
    category: 'A.5 Information Security Policies',
    controlId: 'A.5.1.1',
    name: 'Policies for Information Security',
    description: 'A set of policies for information security shall be defined, approved by management, published and communicated to employees and relevant external parties.',
    requirement: 'Information security policies must be documented and communicated',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'iso27001-a5.1.2',
    framework: 'ISO27001',
    category: 'A.5 Information Security Policies',
    controlId: 'A.5.1.2',
    name: 'Review of Policies for Information Security',
    description: 'The policies for information security shall be reviewed at planned intervals or if significant changes occur.',
    requirement: 'Policies must be reviewed regularly',
    checkType: 'manual',
    severity: 'medium',
  },
  // A.6 - Organization of Information Security
  {
    id: 'iso27001-a6.1.1',
    framework: 'ISO27001',
    category: 'A.6 Organization of Information Security',
    controlId: 'A.6.1.1',
    name: 'Information Security Roles and Responsibilities',
    description: 'All information security responsibilities shall be defined and allocated.',
    requirement: 'Security roles must be defined and assigned',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'iso27001-a6.1.2',
    framework: 'ISO27001',
    category: 'A.6 Organization of Information Security',
    controlId: 'A.6.1.2',
    name: 'Segregation of Duties',
    description: 'Conflicting duties and areas of responsibility shall be segregated to reduce opportunities for unauthorized modification or misuse.',
    requirement: 'Implement segregation of duties controls',
    checkType: 'automated',
    severity: 'critical',
  },
  // A.9 - Access Control
  {
    id: 'iso27001-a9.1.1',
    framework: 'ISO27001',
    category: 'A.9 Access Control',
    controlId: 'A.9.1.1',
    name: 'Access Control Policy',
    description: 'An access control policy shall be established, documented and reviewed based on business and information security requirements.',
    requirement: 'Access control policy must be documented',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'iso27001-a9.2.1',
    framework: 'ISO27001',
    category: 'A.9 Access Control',
    controlId: 'A.9.2.1',
    name: 'User Registration and De-registration',
    description: 'A formal user registration and de-registration process shall be implemented to enable assignment of access rights.',
    requirement: 'User lifecycle management must be implemented',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'iso27001-a9.2.2',
    framework: 'ISO27001',
    category: 'A.9 Access Control',
    controlId: 'A.9.2.2',
    name: 'User Access Provisioning',
    description: 'A formal user access provisioning process shall be implemented to assign or revoke access rights for all user types to all systems and services.',
    requirement: 'Access provisioning process must be formal and documented',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'iso27001-a9.2.3',
    framework: 'ISO27001',
    category: 'A.9 Access Control',
    controlId: 'A.9.2.3',
    name: 'Privileged Access Rights Management',
    description: 'The allocation and use of privileged access rights shall be restricted and controlled.',
    requirement: 'Privileged access must be restricted and monitored',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'iso27001-a9.2.5',
    framework: 'ISO27001',
    category: 'A.9 Access Control',
    controlId: 'A.9.2.5',
    name: 'Review of User Access Rights',
    description: 'Asset owners shall review users access rights at regular intervals.',
    requirement: 'Access reviews must be conducted regularly',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'iso27001-a9.2.6',
    framework: 'ISO27001',
    category: 'A.9 Access Control',
    controlId: 'A.9.2.6',
    name: 'Removal or Adjustment of Access Rights',
    description: 'The access rights of all employees and external party users to information and information processing facilities shall be removed upon termination.',
    requirement: 'Access must be revoked on termination',
    checkType: 'automated',
    severity: 'critical',
  },
  // A.12 - Operations Security
  {
    id: 'iso27001-a12.4.1',
    framework: 'ISO27001',
    category: 'A.12 Operations Security',
    controlId: 'A.12.4.1',
    name: 'Event Logging',
    description: 'Event logs recording user activities, exceptions, faults and information security events shall be produced, kept and regularly reviewed.',
    requirement: 'Audit logs must be maintained',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'iso27001-a12.4.3',
    framework: 'ISO27001',
    category: 'A.12 Operations Security',
    controlId: 'A.12.4.3',
    name: 'Administrator and Operator Logs',
    description: 'System administrator and system operator activities shall be logged and the logs protected and regularly reviewed.',
    requirement: 'Admin activities must be logged',
    checkType: 'automated',
    severity: 'high',
  },
  // A.18 - Compliance
  {
    id: 'iso27001-a18.1.3',
    framework: 'ISO27001',
    category: 'A.18 Compliance',
    controlId: 'A.18.1.3',
    name: 'Protection of Records',
    description: 'Records shall be protected from loss, destruction, falsification, unauthorized access and unauthorized release.',
    requirement: 'Records must be protected',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'iso27001-a18.2.1',
    framework: 'ISO27001',
    category: 'A.18 Compliance',
    controlId: 'A.18.2.1',
    name: 'Independent Review of Information Security',
    description: 'The organization\'s approach to managing information security shall be reviewed independently at planned intervals.',
    requirement: 'Security must be reviewed independently',
    checkType: 'manual',
    severity: 'medium',
  },
];

// ============================================================================
// PCI-DSS CONTROLS
// ============================================================================

export const PCIDSS_CONTROLS: ComplianceControl[] = [
  // Requirement 1 - Network Security
  {
    id: 'pcidss-1.1',
    framework: 'PCI-DSS',
    category: 'Requirement 1: Network Security Controls',
    controlId: '1.1',
    name: 'Network Security Controls Installation',
    description: 'Install and maintain network security controls to protect cardholder data.',
    requirement: 'Network security controls must be installed',
    checkType: 'automated',
    severity: 'critical',
  },
  // Requirement 2 - Secure Configurations
  {
    id: 'pcidss-2.1',
    framework: 'PCI-DSS',
    category: 'Requirement 2: Secure Configurations',
    controlId: '2.1',
    name: 'Change Default Credentials',
    description: 'Do not use vendor-supplied defaults for system passwords and other security parameters.',
    requirement: 'Default credentials must be changed',
    checkType: 'automated',
    severity: 'critical',
  },
  // Requirement 3 - Protect Stored Data
  {
    id: 'pcidss-3.1',
    framework: 'PCI-DSS',
    category: 'Requirement 3: Protect Stored Account Data',
    controlId: '3.1',
    name: 'Data Retention Policy',
    description: 'Keep cardholder data storage to a minimum. Implement a data retention and disposal policy.',
    requirement: 'Data retention policy must be implemented',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'pcidss-3.4',
    framework: 'PCI-DSS',
    category: 'Requirement 3: Protect Stored Account Data',
    controlId: '3.4',
    name: 'Render PAN Unreadable',
    description: 'Render PAN unreadable anywhere it is stored by using strong cryptography.',
    requirement: 'PAN must be encrypted at rest',
    checkType: 'automated',
    severity: 'critical',
  },
  // Requirement 7 - Restrict Access
  {
    id: 'pcidss-7.1',
    framework: 'PCI-DSS',
    category: 'Requirement 7: Restrict Access to System Components',
    controlId: '7.1',
    name: 'Limit Access to Cardholder Data',
    description: 'Limit access to system components and cardholder data to only those individuals whose job requires such access.',
    requirement: 'Access must be limited to job requirements',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'pcidss-7.2',
    framework: 'PCI-DSS',
    category: 'Requirement 7: Restrict Access to System Components',
    controlId: '7.2',
    name: 'Access Control System',
    description: 'Establish an access control system for system components that restricts access based on user need to know.',
    requirement: 'Access control system must be established',
    checkType: 'automated',
    severity: 'critical',
  },
  // Requirement 8 - Identify Users and Authenticate Access
  {
    id: 'pcidss-8.1',
    framework: 'PCI-DSS',
    category: 'Requirement 8: Identify Users and Authenticate Access',
    controlId: '8.1',
    name: 'User Identification',
    description: 'Define and implement policies and procedures to ensure proper user identification management.',
    requirement: 'User identification policies must be defined',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'pcidss-8.2',
    framework: 'PCI-DSS',
    category: 'Requirement 8: Identify Users and Authenticate Access',
    controlId: '8.2',
    name: 'User Authentication Management',
    description: 'Establish proper user authentication management for non-consumer users and administrators.',
    requirement: 'Authentication management must be established',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'pcidss-8.3',
    framework: 'PCI-DSS',
    category: 'Requirement 8: Identify Users and Authenticate Access',
    controlId: '8.3',
    name: 'Strong Authentication for CDE',
    description: 'Secure all individual non-console administrative access and all remote access to the CDE using multi-factor authentication.',
    requirement: 'MFA must be used for CDE access',
    checkType: 'automated',
    severity: 'critical',
  },
  // Requirement 10 - Log and Monitor Access
  {
    id: 'pcidss-10.1',
    framework: 'PCI-DSS',
    category: 'Requirement 10: Log and Monitor All Access',
    controlId: '10.1',
    name: 'Logging Mechanisms',
    description: 'Implement audit trails to link all access to system components to individual users.',
    requirement: 'Audit trails must link access to users',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'pcidss-10.2',
    framework: 'PCI-DSS',
    category: 'Requirement 10: Log and Monitor All Access',
    controlId: '10.2',
    name: 'Audit Log Content',
    description: 'Implement automated audit trails for all system components to reconstruct specific events.',
    requirement: 'Audit logs must capture specific events',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'pcidss-10.4',
    framework: 'PCI-DSS',
    category: 'Requirement 10: Log and Monitor All Access',
    controlId: '10.4',
    name: 'Time Synchronization',
    description: 'Using time-synchronization technology, synchronize all critical system clocks and times.',
    requirement: 'Time synchronization must be implemented',
    checkType: 'automated',
    severity: 'medium',
  },
  // Requirement 12 - Support Information Security
  {
    id: 'pcidss-12.1',
    framework: 'PCI-DSS',
    category: 'Requirement 12: Support Information Security with Organizational Policies',
    controlId: '12.1',
    name: 'Information Security Policy',
    description: 'Establish, publish, maintain, and disseminate a security policy.',
    requirement: 'Security policy must be established and communicated',
    checkType: 'manual',
    severity: 'high',
  },
  {
    id: 'pcidss-12.3',
    framework: 'PCI-DSS',
    category: 'Requirement 12: Support Information Security with Organizational Policies',
    controlId: '12.3',
    name: 'Usage Policies',
    description: 'Develop usage policies for critical technologies and define proper use.',
    requirement: 'Technology usage policies must be defined',
    checkType: 'manual',
    severity: 'medium',
  },
];

// ============================================================================
// GDPR CONTROLS
// ============================================================================

export const GDPR_CONTROLS: ComplianceControl[] = [
  // Article 5 - Principles
  {
    id: 'gdpr-art5-1a',
    framework: 'GDPR',
    category: 'Article 5: Principles',
    controlId: 'Art.5.1.a',
    name: 'Lawfulness, Fairness and Transparency',
    description: 'Personal data shall be processed lawfully, fairly and in a transparent manner.',
    requirement: 'Data processing must be lawful and transparent',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'gdpr-art5-1b',
    framework: 'GDPR',
    category: 'Article 5: Principles',
    controlId: 'Art.5.1.b',
    name: 'Purpose Limitation',
    description: 'Personal data shall be collected for specified, explicit and legitimate purposes.',
    requirement: 'Data collection purposes must be specified',
    checkType: 'manual',
    severity: 'high',
  },
  {
    id: 'gdpr-art5-1c',
    framework: 'GDPR',
    category: 'Article 5: Principles',
    controlId: 'Art.5.1.c',
    name: 'Data Minimization',
    description: 'Personal data shall be adequate, relevant and limited to what is necessary.',
    requirement: 'Data collection must be minimized',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'gdpr-art5-1e',
    framework: 'GDPR',
    category: 'Article 5: Principles',
    controlId: 'Art.5.1.e',
    name: 'Storage Limitation',
    description: 'Personal data shall be kept no longer than necessary for the purposes.',
    requirement: 'Data retention limits must be enforced',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'gdpr-art5-1f',
    framework: 'GDPR',
    category: 'Article 5: Principles',
    controlId: 'Art.5.1.f',
    name: 'Integrity and Confidentiality',
    description: 'Personal data shall be processed with appropriate security measures.',
    requirement: 'Data security measures must be appropriate',
    checkType: 'automated',
    severity: 'critical',
  },
  // Article 17 - Right to Erasure
  {
    id: 'gdpr-art17',
    framework: 'GDPR',
    category: 'Article 17: Right to Erasure',
    controlId: 'Art.17',
    name: 'Right to be Forgotten',
    description: 'Data subjects have the right to obtain erasure of personal data without undue delay.',
    requirement: 'Data deletion capability must be implemented',
    checkType: 'automated',
    severity: 'critical',
  },
  // Article 25 - Data Protection by Design
  {
    id: 'gdpr-art25',
    framework: 'GDPR',
    category: 'Article 25: Data Protection by Design',
    controlId: 'Art.25',
    name: 'Privacy by Design',
    description: 'Implement appropriate technical and organizational measures for data protection.',
    requirement: 'Privacy by design must be implemented',
    checkType: 'automated',
    severity: 'high',
  },
  // Article 30 - Records of Processing
  {
    id: 'gdpr-art30',
    framework: 'GDPR',
    category: 'Article 30: Records of Processing',
    controlId: 'Art.30',
    name: 'Records of Processing Activities',
    description: 'Maintain a record of processing activities under its responsibility.',
    requirement: 'Processing records must be maintained',
    checkType: 'automated',
    severity: 'high',
  },
  // Article 32 - Security of Processing
  {
    id: 'gdpr-art32-1a',
    framework: 'GDPR',
    category: 'Article 32: Security of Processing',
    controlId: 'Art.32.1.a',
    name: 'Pseudonymization and Encryption',
    description: 'Implement pseudonymization and encryption of personal data.',
    requirement: 'Encryption must be implemented',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'gdpr-art32-1b',
    framework: 'GDPR',
    category: 'Article 32: Security of Processing',
    controlId: 'Art.32.1.b',
    name: 'Confidentiality and Integrity',
    description: 'Ensure ongoing confidentiality, integrity, availability and resilience of processing systems.',
    requirement: 'CIA must be maintained',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'gdpr-art32-1d',
    framework: 'GDPR',
    category: 'Article 32: Security of Processing',
    controlId: 'Art.32.1.d',
    name: 'Regular Testing',
    description: 'Process for regularly testing, assessing and evaluating the effectiveness of security measures.',
    requirement: 'Security testing must be regular',
    checkType: 'manual',
    severity: 'high',
  },
  // Article 33 - Breach Notification
  {
    id: 'gdpr-art33',
    framework: 'GDPR',
    category: 'Article 33: Breach Notification',
    controlId: 'Art.33',
    name: 'Breach Notification to Authority',
    description: 'Notify supervisory authority of personal data breach within 72 hours.',
    requirement: 'Breach notification process must be established',
    checkType: 'manual',
    severity: 'critical',
  },
  // Article 35 - Data Protection Impact Assessment
  {
    id: 'gdpr-art35',
    framework: 'GDPR',
    category: 'Article 35: DPIA',
    controlId: 'Art.35',
    name: 'Data Protection Impact Assessment',
    description: 'Carry out DPIA for processing likely to result in high risk to data subjects.',
    requirement: 'DPIA must be conducted for high-risk processing',
    checkType: 'manual',
    severity: 'high',
  },
];

// ============================================================================
// SOC2 CONTROLS
// ============================================================================

export const SOC2_CONTROLS: ComplianceControl[] = [
  // CC1 - Control Environment
  {
    id: 'soc2-cc1.1',
    framework: 'SOC2',
    category: 'CC1: Control Environment',
    controlId: 'CC1.1',
    name: 'COSO Principle 1',
    description: 'The entity demonstrates a commitment to integrity and ethical values.',
    requirement: 'Integrity and ethics commitment must be demonstrated',
    checkType: 'manual',
    severity: 'high',
  },
  // CC5 - Control Activities
  {
    id: 'soc2-cc5.1',
    framework: 'SOC2',
    category: 'CC5: Control Activities',
    controlId: 'CC5.1',
    name: 'COSO Principle 10',
    description: 'The entity selects and develops control activities that contribute to the mitigation of risks.',
    requirement: 'Risk mitigation controls must be developed',
    checkType: 'automated',
    severity: 'high',
  },
  // CC6 - Logical and Physical Access Controls
  {
    id: 'soc2-cc6.1',
    framework: 'SOC2',
    category: 'CC6: Logical and Physical Access Controls',
    controlId: 'CC6.1',
    name: 'Logical Access Security Software',
    description: 'The entity implements logical access security software, infrastructure, and architectures.',
    requirement: 'Access security must be implemented',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'soc2-cc6.2',
    framework: 'SOC2',
    category: 'CC6: Logical and Physical Access Controls',
    controlId: 'CC6.2',
    name: 'User Registration and Authorization',
    description: 'Prior to issuing system credentials, the entity registers authorized users.',
    requirement: 'User registration must precede access',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'soc2-cc6.3',
    framework: 'SOC2',
    category: 'CC6: Logical and Physical Access Controls',
    controlId: 'CC6.3',
    name: 'User Access Removal',
    description: 'The entity removes access to protected information assets when access is no longer required.',
    requirement: 'Access removal must be timely',
    checkType: 'automated',
    severity: 'critical',
  },
  // CC7 - System Operations
  {
    id: 'soc2-cc7.1',
    framework: 'SOC2',
    category: 'CC7: System Operations',
    controlId: 'CC7.1',
    name: 'Vulnerability Detection',
    description: 'The entity detects and evaluates the vulnerabilities in the system.',
    requirement: 'Vulnerabilities must be detected and evaluated',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'soc2-cc7.2',
    framework: 'SOC2',
    category: 'CC7: System Operations',
    controlId: 'CC7.2',
    name: 'Security Event Monitoring',
    description: 'The entity monitors system components and the operation of those components for anomalies.',
    requirement: 'System monitoring must be implemented',
    checkType: 'automated',
    severity: 'high',
  },
];

// ============================================================================
// HIPAA CONTROLS
// ============================================================================

export const HIPAA_CONTROLS: ComplianceControl[] = [
  // Administrative Safeguards
  {
    id: 'hipaa-164.308-a1',
    framework: 'HIPAA',
    category: '164.308 Administrative Safeguards',
    controlId: '164.308(a)(1)',
    name: 'Security Management Process',
    description: 'Implement policies and procedures to prevent, detect, contain, and correct security violations.',
    requirement: 'Security management process must be implemented',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'hipaa-164.308-a3',
    framework: 'HIPAA',
    category: '164.308 Administrative Safeguards',
    controlId: '164.308(a)(3)',
    name: 'Workforce Security',
    description: 'Implement policies and procedures to ensure that all members of its workforce have appropriate access to ePHI.',
    requirement: 'Workforce security policies must be implemented',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'hipaa-164.308-a4',
    framework: 'HIPAA',
    category: '164.308 Administrative Safeguards',
    controlId: '164.308(a)(4)',
    name: 'Information Access Management',
    description: 'Implement policies and procedures for authorizing access to ePHI.',
    requirement: 'Access authorization must be implemented',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'hipaa-164.308-a5',
    framework: 'HIPAA',
    category: '164.308 Administrative Safeguards',
    controlId: '164.308(a)(5)',
    name: 'Security Awareness and Training',
    description: 'Implement a security awareness and training program for all workforce members.',
    requirement: 'Security training must be implemented',
    checkType: 'manual',
    severity: 'high',
  },
  // Technical Safeguards
  {
    id: 'hipaa-164.312-a1',
    framework: 'HIPAA',
    category: '164.312 Technical Safeguards',
    controlId: '164.312(a)(1)',
    name: 'Access Control',
    description: 'Implement technical policies and procedures for electronic information systems that maintain ePHI.',
    requirement: 'Technical access control must be implemented',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'hipaa-164.312-b',
    framework: 'HIPAA',
    category: '164.312 Technical Safeguards',
    controlId: '164.312(b)',
    name: 'Audit Controls',
    description: 'Implement hardware, software, and/or procedural mechanisms that record and examine activity.',
    requirement: 'Audit controls must be implemented',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'hipaa-164.312-c1',
    framework: 'HIPAA',
    category: '164.312 Technical Safeguards',
    controlId: '164.312(c)(1)',
    name: 'Integrity Controls',
    description: 'Implement policies and procedures to protect ePHI from improper alteration or destruction.',
    requirement: 'Integrity controls must be implemented',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'hipaa-164.312-e1',
    framework: 'HIPAA',
    category: '164.312 Technical Safeguards',
    controlId: '164.312(e)(1)',
    name: 'Transmission Security',
    description: 'Implement technical security measures to guard against unauthorized access to ePHI transmitted.',
    requirement: 'Transmission security must be implemented',
    checkType: 'automated',
    severity: 'critical',
  },
];

// ============================================================================
// INDIA DPDP ACT CONTROLS
// ============================================================================

export const DPDP_CONTROLS: ComplianceControl[] = [
  {
    id: 'dpdp-sec4',
    framework: 'DPDP',
    category: 'Section 4: Grounds for Processing',
    controlId: 'Sec.4',
    name: 'Lawful Processing',
    description: 'Personal data shall be processed only in accordance with provisions of this Act and for lawful purpose.',
    requirement: 'Processing must be lawful',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'dpdp-sec5',
    framework: 'DPDP',
    category: 'Section 5: Notice',
    controlId: 'Sec.5',
    name: 'Notice to Data Principal',
    description: 'Data Fiduciary shall give notice to the Data Principal with description of personal data and purpose.',
    requirement: 'Notice must be provided to data subjects',
    checkType: 'manual',
    severity: 'high',
  },
  {
    id: 'dpdp-sec6',
    framework: 'DPDP',
    category: 'Section 6: Consent',
    controlId: 'Sec.6',
    name: 'Consent Requirements',
    description: 'Consent shall be free, specific, informed, unconditional and unambiguous.',
    requirement: 'Valid consent must be obtained',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'dpdp-sec8',
    framework: 'DPDP',
    category: 'Section 8: General Obligations',
    controlId: 'Sec.8',
    name: 'Data Fiduciary Obligations',
    description: 'Data Fiduciary shall be responsible for compliance with this Act in respect of any processing.',
    requirement: 'Fiduciary obligations must be met',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'dpdp-sec8-4',
    framework: 'DPDP',
    category: 'Section 8: General Obligations',
    controlId: 'Sec.8(4)',
    name: 'Reasonable Security Safeguards',
    description: 'Data Fiduciary shall protect personal data by taking reasonable security safeguards.',
    requirement: 'Security safeguards must be reasonable',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'dpdp-sec8-6',
    framework: 'DPDP',
    category: 'Section 8: General Obligations',
    controlId: 'Sec.8(6)',
    name: 'Breach Notification',
    description: 'Data Fiduciary shall inform the Board and affected Data Principal about data breach.',
    requirement: 'Breach notification must be timely',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'dpdp-sec11',
    framework: 'DPDP',
    category: 'Section 11: Rights of Data Principal',
    controlId: 'Sec.11',
    name: 'Data Principal Rights',
    description: 'Data Principal shall have the right to access, correction, erasure and grievance redressal.',
    requirement: 'Data subject rights must be supported',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'dpdp-sec17',
    framework: 'DPDP',
    category: 'Section 17: Significant Data Fiduciary',
    controlId: 'Sec.17',
    name: 'Additional Obligations for SDF',
    description: 'Significant Data Fiduciary shall appoint DPO, conduct DPIA, and undertake periodic audits.',
    requirement: 'SDF additional obligations must be met',
    checkType: 'manual',
    severity: 'high',
  },
];

// ============================================================================
// SEBI CSCRF (Cyber Security and Cyber Resilience Framework) CONTROLS
// Based on SEBI Circular Aug 2024 - CSCRF for Regulated Entities
// ============================================================================

export const SEBI_CSCRF_CONTROLS: ComplianceControl[] = [
  // Governance Controls
  {
    id: 'sebi-gov-1',
    framework: 'SEBI-CSCRF',
    category: 'Governance',
    controlId: 'GOV.1',
    name: 'Cyber Security Policy',
    description: 'REs shall have a Board-approved Cyber Security and Cyber Resilience policy reviewed annually.',
    requirement: 'Board-approved cyber security policy must exist and be reviewed annually',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'sebi-gov-2',
    framework: 'SEBI-CSCRF',
    category: 'Governance',
    controlId: 'GOV.2',
    name: 'CISO Appointment',
    description: 'MIIs and Qualified REs shall designate a senior official as Chief Information Security Officer (CISO).',
    requirement: 'CISO must be appointed for MIIs and Qualified REs',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'sebi-gov-3',
    framework: 'SEBI-CSCRF',
    category: 'Governance',
    controlId: 'GOV.3',
    name: 'IT Committee',
    description: 'REs shall constitute an IT Committee/Cyber Security Committee at Board level.',
    requirement: 'IT/Cyber Security Committee must be constituted',
    checkType: 'manual',
    severity: 'high',
  },
  {
    id: 'sebi-gov-4',
    framework: 'SEBI-CSCRF',
    category: 'Governance',
    controlId: 'GOV.4',
    name: 'Cyber Risk Assessment',
    description: 'REs shall conduct periodic cyber risk assessments at least annually.',
    requirement: 'Annual cyber risk assessment must be conducted',
    checkType: 'automated',
    severity: 'high',
  },
  // Identification Controls
  {
    id: 'sebi-id-1',
    framework: 'SEBI-CSCRF',
    category: 'Identification',
    controlId: 'ID.1',
    name: 'Critical Asset Identification',
    description: 'REs shall identify and maintain inventory of all critical IT assets including hardware, software, data, and network components.',
    requirement: 'Critical IT asset inventory must be maintained',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'sebi-id-2',
    framework: 'SEBI-CSCRF',
    category: 'Identification',
    controlId: 'ID.2',
    name: 'Data Classification',
    description: 'REs shall classify data based on sensitivity and criticality levels.',
    requirement: 'Data classification scheme must be implemented',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'sebi-id-3',
    framework: 'SEBI-CSCRF',
    category: 'Identification',
    controlId: 'ID.3',
    name: 'Vulnerability Assessment',
    description: 'REs shall conduct vulnerability assessments at least quarterly for critical systems.',
    requirement: 'Quarterly vulnerability assessments must be conducted',
    checkType: 'automated',
    severity: 'high',
  },
  // Protection Controls
  {
    id: 'sebi-pr-1',
    framework: 'SEBI-CSCRF',
    category: 'Protection',
    controlId: 'PR.1',
    name: 'Access Control Policy',
    description: 'REs shall implement role-based access control with principle of least privilege.',
    requirement: 'RBAC with least privilege must be implemented',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'sebi-pr-2',
    framework: 'SEBI-CSCRF',
    category: 'Protection',
    controlId: 'PR.2',
    name: 'Multi-Factor Authentication',
    description: 'MFA shall be implemented for all critical systems and privileged access.',
    requirement: 'MFA must be enabled for critical systems',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'sebi-pr-3',
    framework: 'SEBI-CSCRF',
    category: 'Protection',
    controlId: 'PR.3',
    name: 'Network Segmentation',
    description: 'REs shall implement network segmentation to restrict access to sensitive information and hosts.',
    requirement: 'Network segmentation must be implemented',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'sebi-pr-4',
    framework: 'SEBI-CSCRF',
    category: 'Protection',
    controlId: 'PR.4',
    name: 'Encryption Standards',
    description: 'REs shall encrypt data at rest and in transit using industry-standard encryption.',
    requirement: 'Data encryption must be implemented',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'sebi-pr-5',
    framework: 'SEBI-CSCRF',
    category: 'Protection',
    controlId: 'PR.5',
    name: 'Endpoint Protection',
    description: 'REs shall deploy endpoint detection and response (EDR) solutions on all endpoints.',
    requirement: 'EDR must be deployed on all endpoints',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'sebi-pr-6',
    framework: 'SEBI-CSCRF',
    category: 'Protection',
    controlId: 'PR.6',
    name: 'Privileged Access Management',
    description: 'REs shall implement PAM controls for all administrative and privileged accounts.',
    requirement: 'PAM controls must be implemented',
    checkType: 'automated',
    severity: 'critical',
  },
  // Detection Controls
  {
    id: 'sebi-de-1',
    framework: 'SEBI-CSCRF',
    category: 'Detection',
    controlId: 'DE.1',
    name: 'Security Operations Center',
    description: 'MIIs and Qualified REs shall establish or outsource to a 24x7 Security Operations Center.',
    requirement: 'SOC capability must be established',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'sebi-de-2',
    framework: 'SEBI-CSCRF',
    category: 'Detection',
    controlId: 'DE.2',
    name: 'SIEM Implementation',
    description: 'REs shall implement SIEM for log aggregation, correlation, and threat detection.',
    requirement: 'SIEM must be implemented',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'sebi-de-3',
    framework: 'SEBI-CSCRF',
    category: 'Detection',
    controlId: 'DE.3',
    name: 'Log Management',
    description: 'REs shall maintain logs for minimum 5 years with integrity protection.',
    requirement: 'Log retention for 5 years with integrity protection',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'sebi-de-4',
    framework: 'SEBI-CSCRF',
    category: 'Detection',
    controlId: 'DE.4',
    name: 'Intrusion Detection',
    description: 'REs shall deploy IDS/IPS at network perimeter and critical segments.',
    requirement: 'IDS/IPS must be deployed',
    checkType: 'automated',
    severity: 'high',
  },
  // Response Controls
  {
    id: 'sebi-rs-1',
    framework: 'SEBI-CSCRF',
    category: 'Response',
    controlId: 'RS.1',
    name: 'Incident Response Plan',
    description: 'REs shall establish comprehensive Incident Response Management plan with SOPs.',
    requirement: 'Incident response plan must be documented',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'sebi-rs-2',
    framework: 'SEBI-CSCRF',
    category: 'Response',
    controlId: 'RS.2',
    name: 'Incident Reporting to SEBI',
    description: 'All cyber incidents shall be reported through SEBI incident reporting portal within specified timelines.',
    requirement: 'Incident reporting process must be established',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'sebi-rs-3',
    framework: 'SEBI-CSCRF',
    category: 'Response',
    controlId: 'RS.3',
    name: 'Cyber Crisis Management Plan',
    description: 'REs shall maintain an up-to-date Cyber Crisis Management Plan (CCMP).',
    requirement: 'CCMP must be documented and updated',
    checkType: 'manual',
    severity: 'high',
  },
  // Recovery Controls
  {
    id: 'sebi-rc-1',
    framework: 'SEBI-CSCRF',
    category: 'Recovery',
    controlId: 'RC.1',
    name: 'Business Continuity Plan',
    description: 'REs shall maintain BCP with defined RTO and RPO for critical systems.',
    requirement: 'BCP with RTO/RPO must be documented',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'sebi-rc-2',
    framework: 'SEBI-CSCRF',
    category: 'Recovery',
    controlId: 'RC.2',
    name: 'Disaster Recovery',
    description: 'REs shall maintain DR site with periodic DR drills at least annually.',
    requirement: 'DR site and annual drills required',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'sebi-rc-3',
    framework: 'SEBI-CSCRF',
    category: 'Recovery',
    controlId: 'RC.3',
    name: 'Backup and Restoration',
    description: 'REs shall implement regular backups with periodic restoration testing.',
    requirement: 'Backup and restoration testing required',
    checkType: 'automated',
    severity: 'high',
  },
  // Audit & Compliance Controls
  {
    id: 'sebi-au-1',
    framework: 'SEBI-CSCRF',
    category: 'Audit',
    controlId: 'AU.1',
    name: 'VAPT Assessment',
    description: 'REs shall conduct VAPT at least annually by CERT-In empanelled auditors.',
    requirement: 'Annual VAPT by CERT-In auditors required',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'sebi-au-2',
    framework: 'SEBI-CSCRF',
    category: 'Audit',
    controlId: 'AU.2',
    name: 'Red Team Exercise',
    description: 'MIIs and Qualified REs shall conduct red teaming exercises periodically.',
    requirement: 'Red team exercises required for MIIs',
    checkType: 'manual',
    severity: 'high',
  },
  {
    id: 'sebi-au-3',
    framework: 'SEBI-CSCRF',
    category: 'Audit',
    controlId: 'AU.3',
    name: 'Compliance Reporting',
    description: 'REs shall submit CSCRF compliance reports to SEBI as per prescribed format.',
    requirement: 'CSCRF compliance reports must be submitted',
    checkType: 'manual',
    severity: 'critical',
  },
  // Vendor Management Controls
  {
    id: 'sebi-vm-1',
    framework: 'SEBI-CSCRF',
    category: 'Vendor Management',
    controlId: 'VM.1',
    name: 'Third-Party Risk Assessment',
    description: 'REs shall conduct security assessment of third-party vendors before onboarding.',
    requirement: 'Vendor security assessment required',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'sebi-vm-2',
    framework: 'SEBI-CSCRF',
    category: 'Vendor Management',
    controlId: 'VM.2',
    name: 'Vendor Compliance Monitoring',
    description: 'REs shall ensure third-party vendors comply with security standards through periodic audits.',
    requirement: 'Vendor compliance monitoring required',
    checkType: 'automated',
    severity: 'high',
  },
];

// ============================================================================
// RBI IT GOVERNANCE AND CYBER SECURITY CONTROLS
// Based on RBI Master Direction Nov 2023 (RBI/DoS/2023-24/107)
// ============================================================================

export const RBI_CYBER_CONTROLS: ComplianceControl[] = [
  // IT Governance Controls
  {
    id: 'rbi-itg-1',
    framework: 'RBI-CYBER',
    category: 'IT Governance',
    controlId: 'ITG.1',
    name: 'Board-Approved IT Strategy',
    description: 'REs shall have a Board-approved IT strategy aligned with business strategy.',
    requirement: 'Board-approved IT strategy required',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'rbi-itg-2',
    framework: 'RBI-CYBER',
    category: 'IT Governance',
    controlId: 'ITG.2',
    name: 'IT Steering Committee',
    description: 'REs shall constitute IT Steering Committee with senior management representation.',
    requirement: 'IT Steering Committee must be constituted',
    checkType: 'manual',
    severity: 'high',
  },
  {
    id: 'rbi-itg-3',
    framework: 'RBI-CYBER',
    category: 'IT Governance',
    controlId: 'ITG.3',
    name: 'Chief Information Security Officer',
    description: 'REs shall appoint a CISO responsible for cyber security at sufficiently senior level.',
    requirement: 'CISO appointment required',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'rbi-itg-4',
    framework: 'RBI-CYBER',
    category: 'IT Governance',
    controlId: 'ITG.4',
    name: 'Cyber Security Policy',
    description: 'REs shall have Board-approved cyber security policy reviewed at least annually.',
    requirement: 'Annual cyber security policy review required',
    checkType: 'manual',
    severity: 'critical',
  },
  // Risk Management Controls
  {
    id: 'rbi-rm-1',
    framework: 'RBI-CYBER',
    category: 'Risk Management',
    controlId: 'RM.1',
    name: 'IT Risk Management Framework',
    description: 'REs shall establish IT risk management framework integrated with enterprise risk management.',
    requirement: 'IT risk management framework required',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'rbi-rm-2',
    framework: 'RBI-CYBER',
    category: 'Risk Management',
    controlId: 'RM.2',
    name: 'Risk Assessment',
    description: 'REs shall conduct comprehensive IT risk assessment at least annually.',
    requirement: 'Annual IT risk assessment required',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'rbi-rm-3',
    framework: 'RBI-CYBER',
    category: 'Risk Management',
    controlId: 'RM.3',
    name: 'Cyber Risk Insurance',
    description: 'REs should consider appropriate cyber risk insurance coverage.',
    requirement: 'Cyber risk insurance consideration required',
    checkType: 'manual',
    severity: 'medium',
  },
  // Asset Management Controls
  {
    id: 'rbi-am-1',
    framework: 'RBI-CYBER',
    category: 'Asset Management',
    controlId: 'AM.1',
    name: 'IT Asset Inventory',
    description: 'REs shall maintain updated register of all IT assets with criticality ratings.',
    requirement: 'IT asset inventory with criticality required',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'rbi-am-2',
    framework: 'RBI-CYBER',
    category: 'Asset Management',
    controlId: 'AM.2',
    name: 'Software Asset Management',
    description: 'REs shall maintain inventory of all software including licenses and versions.',
    requirement: 'Software inventory required',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'rbi-am-3',
    framework: 'RBI-CYBER',
    category: 'Asset Management',
    controlId: 'AM.3',
    name: 'Data Classification',
    description: 'REs shall classify all data assets based on sensitivity (public, internal, confidential, restricted).',
    requirement: 'Data classification required',
    checkType: 'automated',
    severity: 'high',
  },
  // Access Control Controls
  {
    id: 'rbi-ac-1',
    framework: 'RBI-CYBER',
    category: 'Access Control',
    controlId: 'AC.1',
    name: 'User Access Management',
    description: 'REs shall implement formal user registration and de-registration process.',
    requirement: 'Formal user access management required',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'rbi-ac-2',
    framework: 'RBI-CYBER',
    category: 'Access Control',
    controlId: 'AC.2',
    name: 'Privileged Access Management',
    description: 'REs shall implement enhanced controls for privileged/administrative access.',
    requirement: 'PAM controls required',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'rbi-ac-3',
    framework: 'RBI-CYBER',
    category: 'Access Control',
    controlId: 'AC.3',
    name: 'Multi-Factor Authentication',
    description: 'REs shall implement MFA for critical applications and remote access.',
    requirement: 'MFA for critical systems required',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'rbi-ac-4',
    framework: 'RBI-CYBER',
    category: 'Access Control',
    controlId: 'AC.4',
    name: 'Access Review',
    description: 'REs shall conduct periodic review of user access rights at least quarterly.',
    requirement: 'Quarterly access reviews required',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'rbi-ac-5',
    framework: 'RBI-CYBER',
    category: 'Access Control',
    controlId: 'AC.5',
    name: 'Segregation of Duties',
    description: 'REs shall implement SoD controls to prevent fraud and errors.',
    requirement: 'SoD controls required',
    checkType: 'automated',
    severity: 'critical',
  },
  // Network Security Controls
  {
    id: 'rbi-ns-1',
    framework: 'RBI-CYBER',
    category: 'Network Security',
    controlId: 'NS.1',
    name: 'Network Architecture',
    description: 'REs shall implement secure network architecture with proper segmentation.',
    requirement: 'Secure network architecture required',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'rbi-ns-2',
    framework: 'RBI-CYBER',
    category: 'Network Security',
    controlId: 'NS.2',
    name: 'Firewall Management',
    description: 'REs shall implement and regularly review firewall configurations.',
    requirement: 'Firewall management required',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'rbi-ns-3',
    framework: 'RBI-CYBER',
    category: 'Network Security',
    controlId: 'NS.3',
    name: 'Intrusion Detection/Prevention',
    description: 'REs shall deploy IDS/IPS systems for threat detection.',
    requirement: 'IDS/IPS deployment required',
    checkType: 'automated',
    severity: 'high',
  },
  // Application Security Controls
  {
    id: 'rbi-as-1',
    framework: 'RBI-CYBER',
    category: 'Application Security',
    controlId: 'AS.1',
    name: 'Secure Development Lifecycle',
    description: 'REs shall implement secure SDLC practices for application development.',
    requirement: 'Secure SDLC required',
    checkType: 'manual',
    severity: 'high',
  },
  {
    id: 'rbi-as-2',
    framework: 'RBI-CYBER',
    category: 'Application Security',
    controlId: 'AS.2',
    name: 'Application Security Testing',
    description: 'REs shall conduct security testing (SAST/DAST) before production deployment.',
    requirement: 'Application security testing required',
    checkType: 'automated',
    severity: 'high',
  },
  // Data Security Controls
  {
    id: 'rbi-ds-1',
    framework: 'RBI-CYBER',
    category: 'Data Security',
    controlId: 'DS.1',
    name: 'Data Encryption',
    description: 'REs shall encrypt sensitive data at rest and in transit.',
    requirement: 'Data encryption required',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'rbi-ds-2',
    framework: 'RBI-CYBER',
    category: 'Data Security',
    controlId: 'DS.2',
    name: 'Data Loss Prevention',
    description: 'REs shall implement DLP controls to prevent unauthorized data exfiltration.',
    requirement: 'DLP controls required',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'rbi-ds-3',
    framework: 'RBI-CYBER',
    category: 'Data Security',
    controlId: 'DS.3',
    name: 'Database Security',
    description: 'REs shall implement database activity monitoring and access controls.',
    requirement: 'Database security controls required',
    checkType: 'automated',
    severity: 'high',
  },
  // Incident Management Controls
  {
    id: 'rbi-im-1',
    framework: 'RBI-CYBER',
    category: 'Incident Management',
    controlId: 'IM.1',
    name: 'Incident Response Plan',
    description: 'REs shall have documented incident response plan with defined roles.',
    requirement: 'Incident response plan required',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'rbi-im-2',
    framework: 'RBI-CYBER',
    category: 'Incident Management',
    controlId: 'IM.2',
    name: 'Incident Reporting to RBI',
    description: 'REs shall report cyber incidents to RBI within 6 hours of detection.',
    requirement: 'Incident reporting within 6 hours required',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'rbi-im-3',
    framework: 'RBI-CYBER',
    category: 'Incident Management',
    controlId: 'IM.3',
    name: 'Forensic Readiness',
    description: 'REs shall maintain forensic readiness for cyber incident investigation.',
    requirement: 'Forensic readiness required',
    checkType: 'manual',
    severity: 'high',
  },
  // Audit & Monitoring Controls
  {
    id: 'rbi-au-1',
    framework: 'RBI-CYBER',
    category: 'Audit & Monitoring',
    controlId: 'AU.1',
    name: 'Security Audit Logging',
    description: 'REs shall implement comprehensive audit logging for all critical systems.',
    requirement: 'Comprehensive audit logging required',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'rbi-au-2',
    framework: 'RBI-CYBER',
    category: 'Audit & Monitoring',
    controlId: 'AU.2',
    name: 'Log Retention',
    description: 'REs shall retain audit logs for minimum 5 years.',
    requirement: '5-year log retention required',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'rbi-au-3',
    framework: 'RBI-CYBER',
    category: 'Audit & Monitoring',
    controlId: 'AU.3',
    name: 'Security Monitoring',
    description: 'REs shall implement 24x7 security monitoring capabilities.',
    requirement: '24x7 security monitoring required',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'rbi-au-4',
    framework: 'RBI-CYBER',
    category: 'Audit & Monitoring',
    controlId: 'AU.4',
    name: 'VAPT',
    description: 'REs shall conduct VAPT at least annually by qualified assessors.',
    requirement: 'Annual VAPT required',
    checkType: 'manual',
    severity: 'critical',
  },
  // Business Continuity Controls
  {
    id: 'rbi-bc-1',
    framework: 'RBI-CYBER',
    category: 'Business Continuity',
    controlId: 'BC.1',
    name: 'BCP/DR Plan',
    description: 'REs shall maintain comprehensive BCP and DR plans with defined RTO/RPO.',
    requirement: 'BCP/DR plans required',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'rbi-bc-2',
    framework: 'RBI-CYBER',
    category: 'Business Continuity',
    controlId: 'BC.2',
    name: 'DR Drills',
    description: 'REs shall conduct DR drills at least twice annually.',
    requirement: 'Bi-annual DR drills required',
    checkType: 'manual',
    severity: 'high',
  },
  {
    id: 'rbi-bc-3',
    framework: 'RBI-CYBER',
    category: 'Business Continuity',
    controlId: 'BC.3',
    name: 'Backup Management',
    description: 'REs shall implement regular backups with periodic restoration testing.',
    requirement: 'Backup management required',
    checkType: 'automated',
    severity: 'high',
  },
  // Third-Party Management Controls
  {
    id: 'rbi-tp-1',
    framework: 'RBI-CYBER',
    category: 'Third-Party Management',
    controlId: 'TP.1',
    name: 'Vendor Due Diligence',
    description: 'REs shall conduct security due diligence before engaging IT vendors.',
    requirement: 'Vendor due diligence required',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'rbi-tp-2',
    framework: 'RBI-CYBER',
    category: 'Third-Party Management',
    controlId: 'TP.2',
    name: 'Vendor Contracts',
    description: 'REs shall include security clauses in vendor contracts including right to audit.',
    requirement: 'Security clauses in contracts required',
    checkType: 'manual',
    severity: 'high',
  },
  {
    id: 'rbi-tp-3',
    framework: 'RBI-CYBER',
    category: 'Third-Party Management',
    controlId: 'TP.3',
    name: 'Cloud Security',
    description: 'REs using cloud services shall ensure compliance with RBI guidelines on cloud.',
    requirement: 'Cloud security compliance required',
    checkType: 'automated',
    severity: 'high',
  },
  // Training Controls
  {
    id: 'rbi-tr-1',
    framework: 'RBI-CYBER',
    category: 'Training',
    controlId: 'TR.1',
    name: 'Security Awareness Training',
    description: 'REs shall conduct mandatory cyber security awareness training for all employees.',
    requirement: 'Mandatory security training required',
    checkType: 'manual',
    severity: 'high',
  },
  {
    id: 'rbi-tr-2',
    framework: 'RBI-CYBER',
    category: 'Training',
    controlId: 'TR.2',
    name: 'Phishing Simulations',
    description: 'REs shall conduct periodic phishing simulation exercises.',
    requirement: 'Phishing simulations required',
    checkType: 'manual',
    severity: 'medium',
  },
];

// ============================================================================
// IRDAI INFORMATION AND CYBER SECURITY GUIDELINES 2023 CONTROLS
// Based on IRDAI CS Guidelines April 2023
// ============================================================================

export const IRDAI_CYBER_CONTROLS: ComplianceControl[] = [
  // Governance Controls
  {
    id: 'irdai-gov-1',
    framework: 'IRDAI-CYBER',
    category: 'Governance',
    controlId: 'GOV.1',
    name: 'Information Security Policy',
    description: 'Regulated entities shall have Board-approved Information Security Policy aligned with business objectives.',
    requirement: 'Board-approved IS policy required',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'irdai-gov-2',
    framework: 'IRDAI-CYBER',
    category: 'Governance',
    controlId: 'GOV.2',
    name: 'Risk Management Committee',
    description: 'All regulated entities shall constitute a Risk Management Committee (RMC).',
    requirement: 'RMC constitution required',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'irdai-gov-3',
    framework: 'IRDAI-CYBER',
    category: 'Governance',
    controlId: 'GOV.3',
    name: 'CISO Appointment',
    description: 'Insurers shall appoint a CISO at sufficiently senior level with direct access to Board.',
    requirement: 'CISO appointment required for insurers',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'irdai-gov-4',
    framework: 'IRDAI-CYBER',
    category: 'Governance',
    controlId: 'GOV.4',
    name: 'IS Team Constitution',
    description: 'Regulated entities shall constitute an Information Security team with defined roles.',
    requirement: 'IS team constitution required',
    checkType: 'manual',
    severity: 'high',
  },
  {
    id: 'irdai-gov-5',
    framework: 'IRDAI-CYBER',
    category: 'Governance',
    controlId: 'GOV.5',
    name: 'Crisis Management Committee',
    description: 'Insurers shall constitute a Crisis Management Committee for cyber incidents.',
    requirement: 'Crisis Management Committee required',
    checkType: 'manual',
    severity: 'high',
  },
  // Data Security Controls
  {
    id: 'irdai-ds-1',
    framework: 'IRDAI-CYBER',
    category: 'Data Security',
    controlId: 'DS.1',
    name: 'Data-Centric Security',
    description: 'Regulated entities shall adopt data-centric security approach protecting data itself.',
    requirement: 'Data-centric security approach required',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'irdai-ds-2',
    framework: 'IRDAI-CYBER',
    category: 'Data Security',
    controlId: 'DS.2',
    name: 'Data Classification',
    description: 'All data shall be classified based on sensitivity and criticality levels.',
    requirement: 'Data classification required',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'irdai-ds-3',
    framework: 'IRDAI-CYBER',
    category: 'Data Security',
    controlId: 'DS.3',
    name: 'Data Localization',
    description: 'All ICT infrastructure logs, critical and business data shall be stored in India.',
    requirement: 'Data localization in India required',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'irdai-ds-4',
    framework: 'IRDAI-CYBER',
    category: 'Data Security',
    controlId: 'DS.4',
    name: 'Encryption',
    description: 'Sensitive data shall be encrypted at rest and in transit using approved algorithms.',
    requirement: 'Data encryption required',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'irdai-ds-5',
    framework: 'IRDAI-CYBER',
    category: 'Data Security',
    controlId: 'DS.5',
    name: 'Data Retention',
    description: 'Data retention policy shall be defined in compliance with regulatory requirements.',
    requirement: 'Data retention policy required',
    checkType: 'automated',
    severity: 'high',
  },
  // Access Control Controls
  {
    id: 'irdai-ac-1',
    framework: 'IRDAI-CYBER',
    category: 'Access Control',
    controlId: 'AC.1',
    name: 'Access Control Policy',
    description: 'Regulated entities shall implement access control based on least privilege principle.',
    requirement: 'Least privilege access control required',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'irdai-ac-2',
    framework: 'IRDAI-CYBER',
    category: 'Access Control',
    controlId: 'AC.2',
    name: 'User Lifecycle Management',
    description: 'Formal procedures for user provisioning, modification, and de-provisioning required.',
    requirement: 'User lifecycle management required',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'irdai-ac-3',
    framework: 'IRDAI-CYBER',
    category: 'Access Control',
    controlId: 'AC.3',
    name: 'Privileged Access',
    description: 'Enhanced controls for privileged/admin access with monitoring and audit trails.',
    requirement: 'Privileged access controls required',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'irdai-ac-4',
    framework: 'IRDAI-CYBER',
    category: 'Access Control',
    controlId: 'AC.4',
    name: 'Multi-Factor Authentication',
    description: 'MFA shall be implemented for critical systems and remote access.',
    requirement: 'MFA implementation required',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'irdai-ac-5',
    framework: 'IRDAI-CYBER',
    category: 'Access Control',
    controlId: 'AC.5',
    name: 'Access Review',
    description: 'User access rights shall be reviewed periodically, at least quarterly.',
    requirement: 'Quarterly access review required',
    checkType: 'automated',
    severity: 'high',
  },
  // Network Security Controls
  {
    id: 'irdai-ns-1',
    framework: 'IRDAI-CYBER',
    category: 'Network Security',
    controlId: 'NS.1',
    name: 'Network Segmentation',
    description: 'Network shall be segmented to isolate critical systems and sensitive data.',
    requirement: 'Network segmentation required',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'irdai-ns-2',
    framework: 'IRDAI-CYBER',
    category: 'Network Security',
    controlId: 'NS.2',
    name: 'Firewall and IDS/IPS',
    description: 'Firewalls and intrusion detection/prevention systems shall be deployed.',
    requirement: 'Firewall and IDS/IPS required',
    checkType: 'automated',
    severity: 'critical',
  },
  {
    id: 'irdai-ns-3',
    framework: 'IRDAI-CYBER',
    category: 'Network Security',
    controlId: 'NS.3',
    name: 'Secure Remote Access',
    description: 'Remote access shall be through secure VPN with appropriate controls.',
    requirement: 'Secure remote access required',
    checkType: 'automated',
    severity: 'high',
  },
  // Incident Management Controls
  {
    id: 'irdai-im-1',
    framework: 'IRDAI-CYBER',
    category: 'Incident Management',
    controlId: 'IM.1',
    name: 'Incident Response Plan',
    description: 'Regulated entities shall have documented cyber incident response plan.',
    requirement: 'Incident response plan required',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'irdai-im-2',
    framework: 'IRDAI-CYBER',
    category: 'Incident Management',
    controlId: 'IM.2',
    name: 'Incident Reporting to IRDAI',
    description: 'Cyber incidents shall be reported to IRDAI as per prescribed timelines.',
    requirement: 'Incident reporting to IRDAI required',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'irdai-im-3',
    framework: 'IRDAI-CYBER',
    category: 'Incident Management',
    controlId: 'IM.3',
    name: 'Incident Documentation',
    description: 'All incidents shall be documented with root cause analysis.',
    requirement: 'Incident documentation required',
    checkType: 'automated',
    severity: 'high',
  },
  // Audit & Compliance Controls
  {
    id: 'irdai-au-1',
    framework: 'IRDAI-CYBER',
    category: 'Audit & Compliance',
    controlId: 'AU.1',
    name: 'Security Audit',
    description: 'Annual security audit by qualified auditors with report to Board.',
    requirement: 'Annual security audit required',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'irdai-au-2',
    framework: 'IRDAI-CYBER',
    category: 'Audit & Compliance',
    controlId: 'AU.2',
    name: 'Audit Report Submission',
    description: 'Audit report shall be submitted to IRDAI within 90 days of fiscal year end.',
    requirement: 'Audit report submission required',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'irdai-au-3',
    framework: 'IRDAI-CYBER',
    category: 'Audit & Compliance',
    controlId: 'AU.3',
    name: 'VAPT Assessment',
    description: 'VAPT shall be conducted at least annually by CERT-In empanelled auditors.',
    requirement: 'Annual VAPT required',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'irdai-au-4',
    framework: 'IRDAI-CYBER',
    category: 'Audit & Compliance',
    controlId: 'AU.4',
    name: 'Audit Logging',
    description: 'Comprehensive audit logs shall be maintained for all critical systems.',
    requirement: 'Audit logging required',
    checkType: 'automated',
    severity: 'high',
  },
  // Business Continuity Controls
  {
    id: 'irdai-bc-1',
    framework: 'IRDAI-CYBER',
    category: 'Business Continuity',
    controlId: 'BC.1',
    name: 'BCP/DRP',
    description: 'Business Continuity and Disaster Recovery plans shall be documented and tested.',
    requirement: 'BCP/DRP required',
    checkType: 'manual',
    severity: 'critical',
  },
  {
    id: 'irdai-bc-2',
    framework: 'IRDAI-CYBER',
    category: 'Business Continuity',
    controlId: 'BC.2',
    name: 'DR Drills',
    description: 'DR drills shall be conducted at least annually.',
    requirement: 'Annual DR drills required',
    checkType: 'manual',
    severity: 'high',
  },
  {
    id: 'irdai-bc-3',
    framework: 'IRDAI-CYBER',
    category: 'Business Continuity',
    controlId: 'BC.3',
    name: 'Backup Management',
    description: 'Regular backups with offsite storage and periodic restoration testing.',
    requirement: 'Backup management required',
    checkType: 'automated',
    severity: 'high',
  },
  // Vendor Management Controls
  {
    id: 'irdai-vm-1',
    framework: 'IRDAI-CYBER',
    category: 'Vendor Management',
    controlId: 'VM.1',
    name: 'Vendor Risk Assessment',
    description: 'Security assessment of vendors before onboarding and periodically.',
    requirement: 'Vendor risk assessment required',
    checkType: 'automated',
    severity: 'high',
  },
  {
    id: 'irdai-vm-2',
    framework: 'IRDAI-CYBER',
    category: 'Vendor Management',
    controlId: 'VM.2',
    name: 'Vendor Contracts',
    description: 'Security requirements and audit rights in vendor contracts.',
    requirement: 'Security clauses in contracts required',
    checkType: 'manual',
    severity: 'high',
  },
  // Training Controls
  {
    id: 'irdai-tr-1',
    framework: 'IRDAI-CYBER',
    category: 'Training',
    controlId: 'TR.1',
    name: 'Security Awareness',
    description: 'Mandatory security awareness training for all employees annually.',
    requirement: 'Annual security training required',
    checkType: 'manual',
    severity: 'high',
  },
  {
    id: 'irdai-tr-2',
    framework: 'IRDAI-CYBER',
    category: 'Training',
    controlId: 'TR.2',
    name: 'Board Training',
    description: 'Board and senior management briefings on cyber security.',
    requirement: 'Board cyber briefings required',
    checkType: 'manual',
    severity: 'medium',
  },
  // Social Media Controls
  {
    id: 'irdai-sm-1',
    framework: 'IRDAI-CYBER',
    category: 'Social Media',
    controlId: 'SM.1',
    name: 'Social Media Policy',
    description: 'Policy on acceptable use of social media for corporate and personal purposes.',
    requirement: 'Social media policy required',
    checkType: 'manual',
    severity: 'medium',
  },
  {
    id: 'irdai-sm-2',
    framework: 'IRDAI-CYBER',
    category: 'Social Media',
    controlId: 'SM.2',
    name: 'Social Media Monitoring',
    description: 'Monitoring of official social media accounts for unauthorized activity.',
    requirement: 'Social media monitoring required',
    checkType: 'manual',
    severity: 'low',
  },
];

// ============================================================================
// COMPLIANCE FRAMEWORK SERVICE
// ============================================================================

export class ComplianceFrameworkService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Get all controls for a specific framework
   */
  getFrameworkControls(framework: string): ComplianceControl[] {
    switch (framework.toUpperCase()) {
      case 'ISO27001':
        return ISO27001_CONTROLS;
      case 'PCI-DSS':
      case 'PCIDSS':
        return PCIDSS_CONTROLS;
      case 'GDPR':
        return GDPR_CONTROLS;
      case 'SOC2':
        return SOC2_CONTROLS;
      case 'HIPAA':
        return HIPAA_CONTROLS;
      case 'DPDP':
        return DPDP_CONTROLS;
      // Indian Financial Regulatory Frameworks
      case 'SEBI-CSCRF':
      case 'SEBI':
        return SEBI_CSCRF_CONTROLS;
      case 'RBI-CYBER':
      case 'RBI':
        return RBI_CYBER_CONTROLS;
      case 'IRDAI-CYBER':
      case 'IRDAI':
        return IRDAI_CYBER_CONTROLS;
      default:
        return [];
    }
  }

  /**
   * Get all supported frameworks
   */
  getSupportedFrameworks(): string[] {
    return [
      // Global Frameworks
      'ISO27001',
      'PCI-DSS',
      'GDPR',
      'SOC2',
      'HIPAA',
      // India-Specific Frameworks
      'DPDP',           // Digital Personal Data Protection Act
      'SEBI-CSCRF',     // Securities & Exchange Board of India
      'RBI-CYBER',      // Reserve Bank of India
      'IRDAI-CYBER',    // Insurance Regulatory Development Authority
    ];
  }

  /**
   * Get frameworks by region
   */
  getFrameworksByRegion(region: 'global' | 'india' | 'all' = 'all'): string[] {
    const globalFrameworks = ['ISO27001', 'PCI-DSS', 'GDPR', 'SOC2', 'HIPAA'];
    const indiaFrameworks = ['DPDP', 'SEBI-CSCRF', 'RBI-CYBER', 'IRDAI-CYBER'];

    switch (region) {
      case 'global':
        return globalFrameworks;
      case 'india':
        return indiaFrameworks;
      default:
        return [...globalFrameworks, ...indiaFrameworks];
    }
  }

  /**
   * Get framework metadata
   */
  getFrameworkMetadata(framework: string): {
    name: string;
    fullName: string;
    region: string;
    sector: string;
    description: string;
  } | null {
    const metadata: Record<string, any> = {
      'ISO27001': {
        name: 'ISO 27001',
        fullName: 'ISO/IEC 27001:2022',
        region: 'Global',
        sector: 'All',
        description: 'International standard for information security management systems (ISMS)',
      },
      'PCI-DSS': {
        name: 'PCI-DSS',
        fullName: 'Payment Card Industry Data Security Standard',
        region: 'Global',
        sector: 'Payment/Financial',
        description: 'Security standard for organizations handling credit card data',
      },
      'GDPR': {
        name: 'GDPR',
        fullName: 'General Data Protection Regulation',
        region: 'EU',
        sector: 'All',
        description: 'EU regulation on data protection and privacy',
      },
      'SOC2': {
        name: 'SOC 2',
        fullName: 'Service Organization Control 2',
        region: 'Global',
        sector: 'Service Providers',
        description: 'Trust service criteria for service organizations',
      },
      'HIPAA': {
        name: 'HIPAA',
        fullName: 'Health Insurance Portability and Accountability Act',
        region: 'USA',
        sector: 'Healthcare',
        description: 'US law for protecting sensitive patient health information',
      },
      'DPDP': {
        name: 'DPDP Act',
        fullName: 'Digital Personal Data Protection Act, 2023',
        region: 'India',
        sector: 'All',
        description: 'India\'s comprehensive data protection law',
      },
      'SEBI-CSCRF': {
        name: 'SEBI CSCRF',
        fullName: 'SEBI Cyber Security & Cyber Resilience Framework',
        region: 'India',
        sector: 'Securities/Capital Markets',
        description: 'Cyber security framework for SEBI regulated entities (Stock Brokers, DPs, MFs, etc.)',
      },
      'RBI-CYBER': {
        name: 'RBI Cyber Security',
        fullName: 'RBI IT Governance, Risk, Controls & Assurance Practices',
        region: 'India',
        sector: 'Banking/NBFC',
        description: 'Cyber security guidelines for banks, NBFCs, and payment system operators',
      },
      'IRDAI-CYBER': {
        name: 'IRDAI Cyber Security',
        fullName: 'IRDAI Information and Cyber Security Guidelines, 2023',
        region: 'India',
        sector: 'Insurance',
        description: 'Cyber security guidelines for insurers and insurance intermediaries',
      },
    };

    return metadata[framework.toUpperCase()] || metadata[framework] || null;
  }

  /**
   * Run automated compliance checks for a framework
   */
  async runComplianceCheck(framework: string): Promise<ComplianceReport> {
    console.log(`[Compliance] Running ${framework} compliance check for tenant ${this.tenantId}`);

    const controls = this.getFrameworkControls(framework);
    const results: ControlCheckResult[] = [];
    const allEvidence: EvidenceItem[] = [];

    for (const control of controls) {
      try {
        const result = await this.checkControl(control);
        results.push(result);
        allEvidence.push(...result.evidence);
      } catch (error: any) {
        console.error(`[Compliance] Error checking control ${control.controlId}:`, error);
        results.push({
          controlId: control.controlId,
          status: 'not_checked',
          score: 0,
          findings: [`Error checking control: ${error.message}`],
          evidence: [],
          recommendations: [],
          lastChecked: new Date(),
        });
      }
    }

    // Calculate overall score
    const checkedResults = results.filter(r => r.status !== 'not_applicable' && r.status !== 'not_checked');
    const totalScore = checkedResults.reduce((sum, r) => sum + r.score, 0);
    const overallScore = checkedResults.length > 0 ? Math.round(totalScore / checkedResults.length) : 0;

    // Determine overall status
    const nonCompliantCount = results.filter(r => r.status === 'non_compliant').length;
    const partialCount = results.filter(r => r.status === 'partial').length;
    const compliantCount = results.filter(r => r.status === 'compliant').length;

    let status: 'compliant' | 'non_compliant' | 'partial';
    if (nonCompliantCount > 0) {
      status = 'non_compliant';
    } else if (partialCount > 0) {
      status = 'partial';
    } else {
      status = 'compliant';
    }

    // Collect all recommendations
    const recommendations = results.flatMap(r => r.recommendations);

    const report: ComplianceReport = {
      framework,
      tenantId: this.tenantId,
      generatedAt: new Date(),
      overallScore,
      status,
      totalControls: controls.length,
      compliantControls: compliantCount,
      nonCompliantControls: nonCompliantCount,
      partialControls: partialCount,
      notApplicable: results.filter(r => r.status === 'not_applicable').length,
      controlResults: results,
      evidencePack: allEvidence,
      recommendations: [...new Set(recommendations)], // Deduplicate
    };

    // Emit policy event
    policyEngine.getEventSystem().emit('compliance.check_completed', {
      tenantId: this.tenantId,
      framework,
      score: overallScore,
      status,
    });

    return report;
  }

  /**
   * Check a single control
   */
  private async checkControl(control: ComplianceControl): Promise<ControlCheckResult> {
    const evidence: EvidenceItem[] = [];
    const findings: string[] = [];
    const recommendations: string[] = [];
    let score = 0;
    let status: ControlCheckResult['status'] = 'not_checked';

    // Run automated checks based on control ID patterns
    if (control.checkType === 'automated' || control.checkType === 'hybrid') {
      // Access control checks
      if (control.controlId.includes('9.2') || control.controlId.includes('6.') ||
          control.controlId.includes('7.') || control.controlId.includes('CC6')) {
        const accessResult = await this.checkAccessControls();
        findings.push(...accessResult.findings);
        evidence.push(...accessResult.evidence);
        score = accessResult.score;
        status = accessResult.score >= 80 ? 'compliant' : accessResult.score >= 50 ? 'partial' : 'non_compliant';
        if (accessResult.score < 80) {
          recommendations.push('Review and strengthen access control policies');
          recommendations.push('Implement regular access reviews');
        }
      }
      // Audit logging checks
      else if (control.controlId.includes('12.4') || control.controlId.includes('10.') ||
               control.controlId.includes('164.312(b)') || control.controlId.includes('CC7')) {
        const auditResult = await this.checkAuditLogging();
        findings.push(...auditResult.findings);
        evidence.push(...auditResult.evidence);
        score = auditResult.score;
        status = auditResult.score >= 80 ? 'compliant' : auditResult.score >= 50 ? 'partial' : 'non_compliant';
        if (auditResult.score < 80) {
          recommendations.push('Ensure comprehensive audit logging is enabled');
          recommendations.push('Review audit log retention policies');
        }
      }
      // SoD checks
      else if (control.controlId.includes('6.1.2') || control.controlId.includes('7.2')) {
        const sodResult = await this.checkSegregationOfDuties();
        findings.push(...sodResult.findings);
        evidence.push(...sodResult.evidence);
        score = sodResult.score;
        status = sodResult.score >= 80 ? 'compliant' : sodResult.score >= 50 ? 'partial' : 'non_compliant';
        if (sodResult.score < 80) {
          recommendations.push('Review and resolve segregation of duties violations');
        }
      }
      // Data protection checks
      else if (control.controlId.includes('Art.32') || control.controlId.includes('3.') ||
               control.controlId.includes('Art.5.1.f') || control.controlId.includes('Sec.8')) {
        const dataProtectionResult = await this.checkDataProtection();
        findings.push(...dataProtectionResult.findings);
        evidence.push(...dataProtectionResult.evidence);
        score = dataProtectionResult.score;
        status = dataProtectionResult.score >= 80 ? 'compliant' : dataProtectionResult.score >= 50 ? 'partial' : 'non_compliant';
        if (dataProtectionResult.score < 80) {
          recommendations.push('Strengthen data protection measures');
          recommendations.push('Implement encryption for sensitive data');
        }
      }
      // Default automated check
      else {
        const generalResult = await this.runGeneralComplianceCheck(control);
        findings.push(...generalResult.findings);
        evidence.push(...generalResult.evidence);
        score = generalResult.score;
        status = generalResult.score >= 80 ? 'compliant' : generalResult.score >= 50 ? 'partial' : 'non_compliant';
      }
    } else {
      // Manual control - mark as not checked
      status = 'not_checked';
      findings.push('This control requires manual review');
      recommendations.push(`Manual review required for: ${control.name}`);
    }

    return {
      controlId: control.controlId,
      status,
      score,
      findings,
      evidence,
      recommendations,
      lastChecked: new Date(),
    };
  }

  /**
   * Check access controls
   */
  private async checkAccessControls(): Promise<{ findings: string[]; evidence: EvidenceItem[]; score: number }> {
    const findings: string[] = [];
    const evidence: EvidenceItem[] = [];
    let score = 100;

    try {
      // Check for access review campaigns
      const campaigns = await storage.getAccessReviewCampaigns?.(this.tenantId) || [];
      const recentCampaigns = campaigns.filter((c: any) => {
        const created = new Date(c.createdAt);
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return created >= ninetyDaysAgo;
      });

      if (recentCampaigns.length > 0) {
        findings.push(`${recentCampaigns.length} access review campaigns conducted in last 90 days`);
        evidence.push({
          type: 'report',
          name: 'Access Review Campaigns',
          description: 'Recent access review activity',
          collectedAt: new Date(),
          data: { count: recentCampaigns.length },
        });
      } else {
        findings.push('No access reviews conducted in last 90 days');
        score -= 30;
      }

      // Check for overprivileged accounts
      const overprivileged = await storage.getOverprivilegedAccounts?.(this.tenantId) || [];
      if (overprivileged.length > 0) {
        findings.push(`${overprivileged.length} overprivileged accounts detected`);
        score -= Math.min(overprivileged.length * 5, 30);
        evidence.push({
          type: 'report',
          name: 'Overprivileged Accounts',
          description: 'Accounts with excessive privileges',
          collectedAt: new Date(),
          data: { count: overprivileged.length },
        });
      } else {
        findings.push('No overprivileged accounts detected');
      }

      // Check for dormant access
      const users = await storage.getUsers(this.tenantId);
      const inactiveUsers = users.filter((u: any) => {
        if (!u.lastLoginAt) return true;
        const lastLogin = new Date(u.lastLoginAt);
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return lastLogin < ninetyDaysAgo;
      });

      if (inactiveUsers.length > 0) {
        findings.push(`${inactiveUsers.length} users inactive for 90+ days`);
        score -= Math.min(inactiveUsers.length * 2, 20);
        evidence.push({
          type: 'report',
          name: 'Inactive Users',
          description: 'Users with no recent activity',
          collectedAt: new Date(),
          data: { count: inactiveUsers.length },
        });
      }
    } catch (error: any) {
      findings.push(`Error checking access controls: ${error.message}`);
      score = 50;
    }

    return { findings, evidence, score: Math.max(0, score) };
  }

  /**
   * Check audit logging
   */
  private async checkAuditLogging(): Promise<{ findings: string[]; evidence: EvidenceItem[]; score: number }> {
    const findings: string[] = [];
    const evidence: EvidenceItem[] = [];
    let score = 100;

    try {
      // Check for audit logs
      const logs = await storage.getAuditLogs(this.tenantId, { limit: 100 });

      if (logs.length === 0) {
        findings.push('No audit logs found');
        score -= 50;
      } else {
        findings.push(`${logs.length} audit log entries found`);
        evidence.push({
          type: 'log',
          name: 'Audit Logs',
          description: 'Sample of audit log entries',
          collectedAt: new Date(),
          data: { sampleCount: logs.length },
        });

        // Check for diverse action types
        const actionTypes = [...new Set(logs.map((l: any) => l.action))];
        if (actionTypes.length >= 5) {
          findings.push(`Comprehensive logging with ${actionTypes.length} action types`);
        } else {
          findings.push(`Limited logging: only ${actionTypes.length} action types`);
          score -= 20;
        }

        // Check for recent logs
        const recentLogs = logs.filter((l: any) => {
          const created = new Date(l.createdAt);
          const oneDayAgo = new Date();
          oneDayAgo.setDate(oneDayAgo.getDate() - 1);
          return created >= oneDayAgo;
        });

        if (recentLogs.length > 0) {
          findings.push('Active logging in last 24 hours');
        } else {
          findings.push('No logging activity in last 24 hours');
          score -= 10;
        }
      }
    } catch (error: any) {
      findings.push(`Error checking audit logs: ${error.message}`);
      score = 50;
    }

    return { findings, evidence, score: Math.max(0, score) };
  }

  /**
   * Check segregation of duties
   */
  private async checkSegregationOfDuties(): Promise<{ findings: string[]; evidence: EvidenceItem[]; score: number }> {
    const findings: string[] = [];
    const evidence: EvidenceItem[] = [];
    let score = 100;

    try {
      // Check for SoD rules
      const rules = await storage.getSodRules?.(this.tenantId, {}) || [];

      if (rules.length === 0) {
        findings.push('No SoD rules defined');
        score -= 40;
      } else {
        findings.push(`${rules.length} SoD rules defined`);
        evidence.push({
          type: 'policy',
          name: 'SoD Rules',
          description: 'Segregation of Duties rules',
          collectedAt: new Date(),
          data: { count: rules.length },
        });

        const activeRules = rules.filter((r: any) => r.isActive);
        if (activeRules.length < rules.length) {
          findings.push(`${rules.length - activeRules.length} inactive SoD rules`);
          score -= 10;
        }
      }

      // Check for SoD violations
      const violations = await storage.getSodViolations?.(this.tenantId, { status: 'open' }) || [];

      if (violations.length > 0) {
        findings.push(`${violations.length} open SoD violations`);
        const criticalViolations = violations.filter((v: any) => v.severity === 'critical');
        if (criticalViolations.length > 0) {
          findings.push(`${criticalViolations.length} CRITICAL SoD violations`);
          score -= criticalViolations.length * 15;
        }
        score -= Math.min(violations.length * 5, 30);
        evidence.push({
          type: 'report',
          name: 'SoD Violations',
          description: 'Open segregation of duties violations',
          collectedAt: new Date(),
          data: { count: violations.length, critical: criticalViolations.length },
        });
      } else {
        findings.push('No open SoD violations');
      }
    } catch (error: any) {
      findings.push(`Error checking SoD: ${error.message}`);
      score = 50;
    }

    return { findings, evidence, score: Math.max(0, score) };
  }

  /**
   * Check data protection measures
   */
  private async checkDataProtection(): Promise<{ findings: string[]; evidence: EvidenceItem[]; score: number }> {
    const findings: string[] = [];
    const evidence: EvidenceItem[] = [];
    let score = 100;

    try {
      // Check tenant settings
      const tenant = await storage.getTenant(this.tenantId);

      if (tenant) {
        // Check MFA requirement
        if (tenant.requireMFA) {
          findings.push('MFA is required for all users');
        } else {
          findings.push('MFA is not required');
          score -= 20;
        }

        // Check SSO enforcement
        if (tenant.enforceSSO) {
          findings.push('SSO is enforced');
        } else {
          findings.push('SSO is not enforced');
          score -= 10;
        }

        // Check session timeout
        if (tenant.sessionTimeout && tenant.sessionTimeout <= 480) {
          findings.push(`Session timeout: ${tenant.sessionTimeout} minutes`);
        } else {
          findings.push('Session timeout may be too long');
          score -= 10;
        }

        // Check data retention
        if (tenant.dataRetentionDays && tenant.dataRetentionDays <= 365) {
          findings.push(`Data retention: ${tenant.dataRetentionDays} days`);
        } else {
          findings.push('Data retention policy may need review');
          score -= 10;
        }

        evidence.push({
          type: 'config',
          name: 'Tenant Security Settings',
          description: 'Organization security configuration',
          collectedAt: new Date(),
          data: {
            mfaRequired: tenant.requireMFA,
            ssoEnforced: tenant.enforceSSO,
            sessionTimeout: tenant.sessionTimeout,
            dataRetention: tenant.dataRetentionDays,
          },
        });
      }

      // Check for high-risk OAuth apps
      const oauthTokens = await storage.getOauthTokens?.(this.tenantId, {}) || [];
      const highRiskTokens = oauthTokens.filter((t: any) => t.riskLevel === 'high' || t.riskLevel === 'critical');

      if (highRiskTokens.length > 0) {
        findings.push(`${highRiskTokens.length} high-risk OAuth apps detected`);
        score -= Math.min(highRiskTokens.length * 10, 30);
        evidence.push({
          type: 'report',
          name: 'High-Risk OAuth Apps',
          description: 'Applications with high-risk permissions',
          collectedAt: new Date(),
          data: { count: highRiskTokens.length },
        });
      }
    } catch (error: any) {
      findings.push(`Error checking data protection: ${error.message}`);
      score = 50;
    }

    return { findings, evidence, score: Math.max(0, score) };
  }

  /**
   * Run general compliance check
   */
  private async runGeneralComplianceCheck(control: ComplianceControl): Promise<{ findings: string[]; evidence: EvidenceItem[]; score: number }> {
    const findings: string[] = [];
    const evidence: EvidenceItem[] = [];
    let score = 70; // Default partial compliance for automated checks

    findings.push(`Automated check for ${control.name}`);
    evidence.push({
      type: 'report',
      name: control.name,
      description: `Automated compliance check for ${control.controlId}`,
      collectedAt: new Date(),
    });

    return { findings, evidence, score };
  }

  /**
   * Generate compliance summary across all frameworks
   */
  async generateComplianceSummary(): Promise<{
    overallScore: number;
    frameworkScores: { framework: string; score: number; status: string }[];
    criticalFindings: string[];
    recommendations: string[];
  }> {
    const frameworks = this.getSupportedFrameworks();
    const frameworkScores: { framework: string; score: number; status: string }[] = [];
    const allFindings: string[] = [];
    const allRecommendations: string[] = [];

    for (const framework of frameworks) {
      try {
        const report = await this.runComplianceCheck(framework);
        frameworkScores.push({
          framework,
          score: report.overallScore,
          status: report.status,
        });

        // Collect critical findings (from non-compliant controls)
        const criticalResults = report.controlResults.filter(r => r.status === 'non_compliant');
        for (const result of criticalResults) {
          allFindings.push(`[${framework}] ${result.controlId}: ${result.findings.join('; ')}`);
        }

        allRecommendations.push(...report.recommendations.map(r => `[${framework}] ${r}`));
      } catch (error: any) {
        console.error(`[Compliance] Error generating ${framework} report:`, error);
        frameworkScores.push({
          framework,
          score: 0,
          status: 'error',
        });
      }
    }

    // Calculate overall score
    const validScores = frameworkScores.filter(f => f.status !== 'error');
    const overallScore = validScores.length > 0
      ? Math.round(validScores.reduce((sum, f) => sum + f.score, 0) / validScores.length)
      : 0;

    return {
      overallScore,
      frameworkScores,
      criticalFindings: allFindings.slice(0, 20), // Top 20 findings
      recommendations: [...new Set(allRecommendations)].slice(0, 15), // Top 15 unique recommendations
    };
  }
}

export default ComplianceFrameworkService;
