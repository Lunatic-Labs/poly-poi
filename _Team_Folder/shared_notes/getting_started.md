# Getting Started: Setting Up the Project on Your Computer

Follow these steps in order. You only need to do this once.

---

## Step 1: Install Git

Git is the tool that lets you download and sync the project files from GitHub.

1. Go to [https://git-scm.com/downloads](https://git-scm.com/downloads)
2. Click the download button for your operating system (Windows, Mac, or Linux)
3. Run the installer and click through with all the default options
4. When it's done, open a terminal (see below) and type `git --version` — if you see a version number, Git is installed

> **How to open a terminal:**
>
> - **Mac:** Press `Command + Space`, type "Terminal", hit Enter
> - **Windows:** Press the Windows key, type "Git Bash", hit Enter (installed with Git)

---

## Step 2: Download the Project to Your Computer

This is called "cloning" — it just means copying the project files to your machine.

1. Open your terminal
2. Navigate to a folder where you want to save the project. For example, to put it on your Desktop:
   - **Mac:** `cd ~/Desktop`
   - **Windows (Git Bash):** `cd ~/Desktop`
3. Type the following command and press Enter:

```
git clone https://github.com/Lunatic-Labs/poly-poi.git
```

4. A new folder called `poly-poi` will appear. That's the project!

---

## Step 3: Open the Project

You can now open the `poly-poi` folder in any text editor or file explorer to view and edit files.

> **Recommended free text editor:** [Visual Studio Code](https://code.visualstudio.com/) — download and install it, then open the folder with **File > Open Folder**.

---

## Step 4: Keep Your Files Up to Date

Whenever teammates make changes, you'll want to pull the latest version. Open your terminal, navigate into the project folder, and run:

```
cd poly-poi
git pull
```

This syncs your local copy with the latest changes from GitHub.

---

## Quick Reference

| What you want to do                    | Command                                                  |
| -------------------------------------- | -------------------------------------------------------- |
| Download the project (first time only) | `git clone https://github.com/Lunatic-Labs/poly-poi.git` |
| Get the latest updates                 | `git pull`                                               |
| Check Git is installed                 | `git --version`                                          |

---
