# TicketGame

## Project Structure
- **/app**: The Mobile Application (React Native / Expo)
- **/database**: SQL Scripts for PostgreSQL Database

## Database Design
- **Users**: Hierarchical (Admin -> Tenant -> Dealer -> Agent -> Stockist -> User)
- **Game Schedules**: Configurable draw times (e.g., 1 PM, 6 PM)
- **Game Rates**: Dynamic pricing and winning amounts per game/ticket type
- **Tickets & Transactions**: High-performance, secure betting logic

## Technology Stack
- **Frontend**: React Native (Expo)
- **Backend**: PostgreSQL (Stored Procedures for Logic)
