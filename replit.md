# AssetVault - IT Asset Management SaaS

## Overview

AssetVault is a comprehensive IT Asset Management (IT AM) SaaS application built with modern web technologies. The platform provides multi-tenant support for organizations to manage their IT assets throughout their entire lifecycle, from procurement to disposal. The application features AI-powered optimization recommendations using LLM integration, software license management, compliance tracking, and comprehensive asset analytics.

The system is designed as a full-stack web application with a React-based frontend and Express.js backend, utilizing PostgreSQL for data persistence and incorporating third-party AI services for intelligent asset optimization suggestions.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**September 25, 2025**
- **Fixed Section Headings Implementation**: Enhanced dashboard UX with fixed section headings while maintaining full tile mobility
  - **Fixed Headers**: Added 6 clear section headers that remain stationary while tiles are draggable: Asset Overview, Asset Lifecycle, Expiring Warranties & Licenses, ITAM Insights, Activities, Global Distribution
  - **Professional Styling**: Section headers feature backdrop blur, borders, and shadows for professional appearance with bg-background/90 transparency
  - **Layered Architecture**: Headers positioned with z-index layering and pointer-events-none to ensure tiles can be dragged underneath without interference
  - **Position Adjustments**: Updated all tile default positions to accommodate section headers, maintaining proper visual hierarchy
  - **Testing Coverage**: Added comprehensive data-testid attributes (heading-asset-overview, heading-asset-lifecycle, etc.) for automation testing
  - **Context Preservation**: Section titles provide consistent visual context and organization while preserving complete drag-and-drop functionality

**September 23, 2025**
- **Asset Creation Review Step Implementation**: Added comprehensive review confirmation before asset creation with robust validation
  - **Review Flow**: When creating new assets, users now see a detailed review dialog after clicking "Create Asset" but before the asset is actually created
  - **Two-Button Navigation**: "Back to Edit" (returns to form with data preserved) and "Proceed with Creation" (completes asset creation)
  - **Comprehensive Summary Display**: Organized sections showing Basic Information, Financial Information, Software Details (conditional), Vendor & Company Information, and Notes
  - **Robust Numeric Validation**: Fixed edge cases with empty numeric inputs (purchase cost, used licenses) preventing NaN validation errors
  - **Edit Mode Exception**: Existing asset editing bypasses review and submits directly for streamlined workflow
  - **Field Formatting**: Proper date formatting, currency display ($X.XX), and "Not specified" for empty optional fields
  - **Test Coverage**: Added data-testid attributes for automated testing of review functionality
- **Comprehensive Enhanced Assets Table Implementation**: Completed major overhaul of assets management interface with enterprise-grade functionality
  - **All 13 Asset Columns**: Asset Name, Serial Number, Model, Manufacturer, Category, Type, Status, Location, Assigned To, Purchase Date, Warranty Expiry, Purchase Cost, Actions
  - **Advanced Table Features**: Column visibility controls, proper numeric/date sorting, column-specific filtering, date range calendars for purchase and warranty dates
  - **Visual Enhancements**: Asset type icons (HardDrive, Server, Laptop, etc.), color-coded status badges (green=deployed, blue=in-stock, etc.), professional enterprise design
  - **Performance Optimizations**: Fixed sorting logic for proper numeric and date comparison, numeric purchase cost filtering (>= comparison), responsive layout with horizontal scroll
  - **Data Consistency**: Standardized field naming (assignedUserName), resolved runtime errors, comprehensive data handling
  - **Enterprise UX**: No text truncation, filterable/sortable columns, modern shadcn/ui components, accessibility features with data-testid attributes

**September 22, 2025**
- **Enhanced Team Management with Direct User Creation**: Updated Team Management system to create user accounts directly instead of sending invitations
  - **Auto-User Creation**: When admin creates a team member (name, email, role), system automatically creates user account with fixed password "admin123" (hashed server-side)
  - **Security Features**: Added mustChangePassword field to users schema, forcing password change on first login
  - **Duplicate Email Prevention**: Added comprehensive duplicate email checks within same tenant
  - **Audit Logging**: All user creation actions are logged in Activity Logs system
  - **Username Generation**: Automatically generates unique usernames from email addresses
  - **Email Integration Note**: Outlook integration was dismissed - future email functionality will require manual SMTP configuration or alternative email service
  - **Database Schema**: Added mustChangePassword boolean field to users table with proper migration

**September 19, 2025**
- **Enhanced Dashboard with Comprehensive Asset Category Tiles**: Implemented detailed tile-based dashboard replacing basic metrics grid
  - **Overview Cards**: Total Assets, Active Licenses, Compliance Score, Pending Actions with clickable navigation
  - **Hardware Section**: Individual tiles for PC, Laptop, Server, Racks, Mobile Phone, Tablets with status indicators (Deployed, Stock, Repair)
  - **Hardware Status Tracking**: Comprehensive warranty/AMC overview showing expired, expiring, AMC due metrics
  - **Software License Management**: Detailed license metrics including total, assigned, unassigned, unutilized, renewal due, expired with utilization percentage and progress bar
  - **Peripheral Devices**: Individual tiles for Printers, 3D Printers, Scanners, Mouse, Routers, Switches, Hubs
  - **Other Assets**: CCTV Cameras and Access Control category tiles
  - **Navigation Integration**: All tiles and buttons navigate to filtered asset views with proper URL parameters
  - **Accessibility**: Added comprehensive data-testid attributes for testing and UI automation
- **Global Floating AI Assistant**: Implemented comprehensive AI-powered assistant accessible from all pages
  - **Centered Positioning**: Positioned at right center instead of bottom-right for professional appearance
  - **Customizable Position**: Users can move the assistant up/down with persistent position memory via localStorage
  - **Admin-Only Access**: Role-based access control limiting functionality to admin users
  - **Comprehensive Query Processing**: Handles any ITAM-related questions about assets, licenses, reports, and recommendations
  - **Secure Implementation**: Multi-tenant data isolation, request validation, and audit logging
  - **Enhanced UX**: Character counter, keyboard shortcuts, loading states, and accessibility features

## System Architecture

### Frontend Architecture
The client-side is built as a Single Page Application (SPA) using React with TypeScript. The architecture follows modern React patterns with functional components and hooks. Key design decisions include:

- **React Router Alternative**: Uses Wouter for lightweight client-side routing, providing a smaller bundle size compared to React Router
- **State Management**: Leverages React Query (TanStack Query) for server state management, eliminating the need for complex global state solutions like Redux
- **UI Component System**: Implements shadcn/ui components built on Radix UI primitives, providing accessible and customizable components
- **Styling Strategy**: Uses Tailwind CSS with CSS variables for theming, supporting both light and dark modes
- **Form Management**: Integrates React Hook Form with Zod validation for type-safe form handling

### Backend Architecture
The server-side follows a RESTful API architecture built with Express.js and Node.js:

- **Authentication Strategy**: Implements JWT-based authentication with role-based access control (RBAC) supporting three role levels: read-only, it-manager, and admin
- **Database Layer**: Uses Drizzle ORM with PostgreSQL for type-safe database operations and schema management
- **Multi-tenancy**: Implements tenant isolation at the database level, ensuring data separation between organizations
- **API Design**: RESTful endpoints organized by resource type (assets, licenses, recommendations) with consistent response patterns
- **Middleware Architecture**: Custom authentication middleware for protected routes and request logging for debugging

### Data Storage Solutions
The application uses a relational database approach with PostgreSQL:

- **Database Choice**: PostgreSQL selected for ACID compliance, complex queries, and JSON support for flexible asset specifications
- **ORM Integration**: Drizzle ORM provides type-safe database operations with automatic TypeScript type generation
- **Schema Design**: Normalized relational schema with proper foreign key constraints and indexes for performance
- **Migration Strategy**: Schema versioning through Drizzle migrations for safe database updates across environments

### Authentication and Authorization
Security is implemented through a multi-layered approach:

- **JWT Implementation**: Stateless authentication using JSON Web Tokens with configurable expiration
- **Password Security**: Uses bcrypt for password hashing with configurable salt rounds
- **Role-based Access**: Hierarchical permission system where higher roles inherit lower role permissions
- **Route Protection**: Both frontend and backend route protection ensuring unauthorized access prevention

### AI Integration Architecture
The system incorporates Large Language Model capabilities for intelligent recommendations:

- **OpenAI Integration**: Uses OpenAI's GPT models for analyzing asset utilization patterns and generating optimization suggestions
- **Data Pipeline**: Collects asset utilization metrics (CPU, RAM, disk usage) and processes them for AI analysis
- **Recommendation Engine**: Structured prompts generate actionable insights for asset optimization, license management, and cost reduction
- **Feedback Loop**: Recommendations can be accepted or dismissed, allowing for system learning over time

## External Dependencies

### Core Framework Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL database driver optimized for edge deployment
- **OpenAI**: Official OpenAI JavaScript client for LLM integration and AI-powered recommendations
- **Express.js**: Web application framework for building the REST API server
- **React**: Frontend library for building the user interface with component-based architecture

### Authentication and Security
- **jsonwebtoken**: JWT implementation for secure authentication token management
- **bcrypt**: Password hashing library for secure credential storage
- **connect-pg-simple**: PostgreSQL session store integration (configured but not actively used due to JWT strategy)

### Database and ORM
- **Drizzle ORM**: Type-safe ORM with PostgreSQL support and automatic TypeScript type generation
- **PostgreSQL**: Primary database system for persistent data storage with ACID compliance

### UI and Component Libraries
- **Radix UI**: Comprehensive collection of accessible UI primitives for building the component system
- **Tailwind CSS**: Utility-first CSS framework for styling with design system support
- **Lucide React**: Icon library providing consistent iconography throughout the application

### Development and Build Tools
- **Vite**: Modern build tool for fast development and optimized production builds
- **TypeScript**: Static type checking for improved code quality and developer experience
- **ESBuild**: Fast JavaScript bundler used by Vite for production builds

### Form and Data Management
- **React Hook Form**: Performant form library with minimal re-renders
- **Zod**: TypeScript-first schema validation for API endpoints and form validation
- **TanStack React Query**: Server state management for efficient data fetching and caching

### Development Environment
- **Replit Integration**: Custom Vite plugins for Replit development environment support
- **Hot Module Replacement**: Development-time feature for instant code updates without full page reloads