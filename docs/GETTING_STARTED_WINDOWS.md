# Getting Started with Low-Key Landmarks (Windows)

> On a Mac? See [GETTING_STARTED.md](GETTING_STARTED.md).

This gets the Low-Key Landmarks app running on your Windows PC and lets you make changes to it, without writing any code.

The project includes ready-made Windows scripts, so getting it running is mostly double-clicking. An AI assistant handles the actual changes: you tell it what you want and approve its steps.

---

## The assistant you'll use: OpenAI Codex

**OpenAI Codex** is a coding agent from OpenAI. The Codex app for Windows runs on your PC: it edits the project's files and runs commands, showing you its plan and waiting for your approval first. It comes with a ChatGPT account, and the free plan covers everything here.

To ask Codex for something, type what you want and let it work.

**Alternative:** Claude Cowork (in the Claude desktop app) also works, but on Windows it runs the project inside a separate Linux environment that can't always show the app in your browser, so Codex is the simpler choice on a PC.

---

## Before you start

You'll need:

- A Windows PC, Windows 10 version 22H2 or newer.
- A ChatGPT account for Codex (the free plan is enough).
- A file named **`.env.local`** that will be shared with you. It holds the app's secret passwords. Keep it private: don't post it anywhere, or share its contents.
- A GitHub account with collaborator access on the project repo.

---

## Step 1: Install Codex

1. Install the Codex app for Windows from OpenAI.
2. Sign in with your ChatGPT account (the free plan works).

---

## Step 2: Let Codex set up the project

Open Codex and paste this:

> I'm on Windows. Please install the tools this project needs (git, Python 3.12, and Node.js), download the private GitHub repository github.com/Lunatic-Labs/poly-poi into a folder, then run `windows-scripts\setup-windows.cmd` to finish the setup. Show me each step for approval, and tell me if you need me to sign into GitHub.

Codex will lay out a plan. Read it, then approve. Partway through it will probably ask you to sign into GitHub: do that and come back.

**You should see:** a `poly-poi` folder on your PC and a "Setup complete" message.

---

## Step 3: Add the secret file

Save the **`.env.local`** file sent to you and add it to the top level of the `poly-poi` project folder.

> ⚠️ **Keep this file private.** Never share it, never put it on GitHub. The project is already set up to ignore it, so it won't be sent by accident, but don't copy its contents into a chat or a message.

---

## Step 4: Start the app

Open the `poly-poi` folder, go into the `windows-scripts` folder, and double-click **`start.cmd`**. Two windows open and stay running: one for the backend, one for the frontend.

Then open your web browser and go to **http://localhost:5173**.

---

## Step 5: Make a change

**Describe what you want, and Codex changes the files.**

Type what you want. For example:

> On the visitor home screen, change the welcome message to "Welcome to the Nashville Zoo."

> Add a new amenity type called "Water fountain" with a water-drop icon.

After Codex makes the change, refresh your browser to see it. The app usually updates on its own within a second or two. If it doesn't, ask Codex why.

If anything looks broken or you see red error text, copy that text and paste it to Codex:

> I got this error. What does it mean, and can you fix it?

---

## Step 6: Save and share your work

Your change only exists on your PC until you send it to the team. Codex does this for you. Paste:

> Save my changes on a new branch and open a pull request on GitHub that describes what I changed. Do not push to the main branch.

A **pull request** (PR) is a request to add your changes to the shared project. It lets someone look the change over before it goes live for everyone.

Then tell coworker that you have a PR waiting.

---

## Step 7: When you need to change the database

The app's information (sites, stops, opening hours, and so on) lives in a shared database on a service called Supabase. If your new feature needs a new kind of information, for example a ticket price for each stop, the database needs a new place to store it. Codex handles this.

Describe what you need:

> I need to store a ticket price for each stop. Please create the database migration for this and apply it with the Supabase CLI (`supabase db push`). If the project isn't linked to Supabase yet, help me link it first.

Codex writes a small file called a **migration** (a record of the change to the database's structure, kept with the project so everyone's database stays in step) and then applies it.

> ⚠️ **This database is shared and live.** A change here affects the real website and everyone else right away. Be sure you actually need the change, and read Codex's plan before you approve it. If Codex asks for a "Supabase project reference" to link the project, get it from the Supabase dashboard.

---

## Safety rules

- **The database is shared and live.** While you're clicking around the admin portal to learn, make your own test site and work inside that. Don't edit or delete sites you didn't create.
- **Never share the `.env.local` file** or paste its contents anywhere.
- **Read Codex's plan before approving**, especially anything that deletes data or changes the database.
- **When you're stuck, paste the exact error to Codex** and ask it to explain and fix it.

---

## Cheat sheet

| You want to...       | Do this                                        |
| -------------------- | ---------------------------------------------- |
| Start the app        | Double-click `windows-scripts\start.cmd`       |
| See the app          | Open **http://localhost:5173** in your browser |
| Make a change        | Describe it to Codex                           |
| Save and share it    | Ask Codex to open a pull request               |
| Fix something broken | Paste the error to Codex                       |

---

## Doing it by hand (optional)

If you'd rather not have Codex install and run everything, do it yourself:

1. Install **Python 3.12** from [python.org](https://www.python.org/downloads/) (tick "Add python.exe to PATH"), **Node.js LTS** from [nodejs.org](https://nodejs.org/), and **Git** from [git-scm.com](https://git-scm.com/download/win).
2. Download the project. The simplest way is [GitHub Desktop](https://desktop.github.com/): sign in, then clone `Lunatic-Labs/poly-poi`.
3. Open the `poly-poi` folder, go into `windows-scripts`, and double-click **`setup-windows.cmd`**.
4. Put the `.env.local` file at the top level of the `poly-poi` folder.
5. Double-click **`windows-scripts\start.cmd`**, then open **http://localhost:5173**.

You still use Codex for making changes in Step 5 onward.

---

## If the scripts don't work

These scripts are new and may need a fix on a real PC. If `setup-windows.cmd` or `start.cmd` fails, copy the error message and paste it to Codex.
