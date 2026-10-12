# Deepfake Detection Project

This project is a full-stack web application designed to detect deepfakes in uploaded video or image files. It features a user-friendly interface for uploading media and displays the analysis results, leveraging a powerful backend for processing and a responsive frontend for user interaction.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
  - [Backend](#backend)
  - [Frontend](#frontend)
- [Running the Project](#running-the-project)
- [How It Works](#how-it-works)
- [License](#license)

## Features

- **File Upload:** Securely upload video and image files for analysis.
- **Deepfake Analysis:** Backend processing engine to analyze media files for signs of manipulation.
- **Result Visualization:** A clean and responsive user interface to display the detection results.
- **RESTful API:** A well-defined API for communication between the frontend and backend services.

## Tech Stack

- **Backend:**

  - [Node.js](https://nodejs.org/)
  - [Express.js](https://expressjs.com/)
  - [MySQL](https://www.mysql.com/) for database management.
  - [Multer](https://github.com/expressjs/multer) for handling `multipart/form-data` (file uploads).
  - Nodemon for automatic server restarts during development.

- **Frontend:**
  - Vite as a frontend build tool.
  - JavaScript, HTML5, CSS3 (You can specify your framework like React, Vue, etc. here).

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- Node.js (v18.x or later is recommended)
- npm (comes with Node.js) or Yarn
- Python 3.11 (required for backend Python API)
- A running MySQL server instance.

## Installation & Setup

Follow these steps to get your development environment set up.

1.  **Clone the repository:**

    ```sh
    git clone https://github.com/st5359286/Deepfake-Detection.git
    cd Deepfake-Detection
    ```

### Backend

1.  **Navigate to the backend directory:**

    ```sh
    cd Backend
    ```

2.  **Install Node backend dependencies:**

    ```sh
    npm install
    ```

3.  **(Optional) Run Python ML backend:**

    Navigate to `deepfake-detector-backend` and install dependencies:
    ```sh
    cd deepfake-detector-backend
    python -m pip install -r requirements.txt
    python -m flask --app 'src.api:create_app' run --port 5000
    ```

4.  **Set up environment variables:**

    Create a `.env` file in the `Backend` directory and add your MySQL database credentials. You can use the `.env.example` file as a template:

    ```env
    DB_HOST=localhost
    DB_USER=your_mysql_user
    DB_PASSWORD=your_mysql_password
    DB_NAME=your_database_name
    ```

4.  **Database Setup:**

    Connect to your MySQL instance and create the database specified in your `.env` file. You will also need to create the necessary tables for the application to function.

### Frontend

1.  **Navigate to the frontend directory:**

    ```sh
    cd ../frontend
    ```

2.  **Install dependencies:**

    ```sh
    npm install
    ```

## Running the Project

1.  **Start the Backend Server:**
    From the `Backend` directory, run:

    ```sh
    npm start
    ```

    The backend server will start, typically on a port like `3000` or `8000`. Check the server logs for the exact port.

2.  **Start the Frontend Development Server:**
    From the `frontend` directory, run:
    ```sh
    npm run dev
    ```
    The frontend development server will start. Open your browser and navigate to `http://localhost:5173` (or the URL provided in the terminal).

## How It Works

1.  The user selects a video or image file from the frontend interface.
2.  The file is uploaded to the backend via a `multipart/form-data` request.
3.  **Multer** middleware on the Express server handles the file upload and saves it for processing.
4.  The backend runs a deepfake detection algorithm/model on the uploaded file.
5.  The analysis result is stored and sent back to the frontend via a REST API response.
6.  The frontend displays the detection result to the user.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
