# Getting Started with Low-Key Landmarks (Mac)

> On Windows? See [GETTING_STARTED_WINDOWS.md](GETTING_STARTED_WINDOWS.md).

This gets the Low-Key Landmarks app running on your Mac and lets you make changes to it, without writing any code.

An AI assistant does the hands-on work on your computer. You tell it what you want and approve its steps.

---

## The assistant you'll use: Claude Cowork

**Claude Cowork** is a mode inside the Claude desktop app. It can open folders, read and change the project's files, and run commands on your Mac for you. Before it does anything, it shows you its plan and waits for your approval. Nothing happens without your OK, and you can stop it at any point.

To ask Cowork for something, type what you want and let it work.

**Alternative:** OpenAI Codex, included with a paid ChatGPT plan, is a comparable agent. The Codex app for macOS runs on your computer and can edit files and run commands the same as Cowork, so you can use it the same way throughout.

**You need a paid Claude plan** to use Cowork. If you don't have one, get that sorted first.

---

## Before you start

You'll need:

- A Mac.
- A paid Claude plan (for Cowork).
- A file named **`.env.local`** that will be shared with you. It holds the app's secret passwords. Keep it private: don't post it anywhere, or share its contents.
- A GitHub account with collaborator access on the project repo.

---

## Step 1: Install Claude and turn on Cowork

1. Download the Claude desktop app from **claude.ai/download** and install it.
2. Open it and sign in with your paid account.
3. Turn on **Cowork** (it appears as an option in the app once you're signed in).

**You should see:** a Cowork mode you can open inside Claude.

---

## Step 2: Let Cowork set up the project

Open Cowork and paste this, word for word:

> I'm setting up a coding project on my Mac. The project is a private GitHub repository at github.com/Lunatic-Labs/poly-poi. Please install any tools you need (such as Homebrew, git, Python 3.12, Node, and the GitHub command-line tool), download the project into a folder in my home directory, and run its first-time setup using `make setup`. Show me each step for approval, and tell me if you need me to log into GitHub.

Cowork will lay out a plan. Read it, then approve. Partway through it will probably ask you to log into GitHub in your browser: do that and come back.

**You should see:** a folder named **`poly-poi`** in your home folder, and a message that setup finished.

---

## Step 3: Add the secret file

Find the **`.env.local`** file sent to you. It needs to sit at the top level of the `poly-poi` folder.

Or have Cowork do it:

> Move the file in my Downloads named `.env.local` into the top level of the `poly-poi` project folder.

> ⚠️ **Keep this file private.** Never share it, never put it on GitHub. The project is already set up to ignore it, so it won't be sent by accident, but don't copy its contents into a chat or a message.

---

## Step 4: Start the app

Ask Cowork:

> Start the app. Run `make backend` in one terminal and `make frontend` in another, and leave both running.

**You should see:** after a short wait, the app opens at **http://localhost:5173**. Open that address in your web browser.

Quick health check: the address **http://localhost:8000/health** should show `{"status":"ok","version":"0.1.0"}`. If it does, the backend is healthy.

Leave those two terminals running while you work. When you're done for the day, close them or ask Cowork to stop the app.

---

## Step 5: Make a change

**Describe what you want, and Cowork changes the files. You never edit code.**

For example:

> On the visitor home screen, change the welcome message to "Welcome to the Nashville Zoo."

> Add a new amenity type called "Water fountain" with a water-drop icon.

After Cowork makes the change, refresh your browser to see it. The app usually updates on its own within a second or two. If it doesn't, ask Cowork why.

If anything looks broken or you see red error text, copy that text and paste it to Cowork:

> I got this error. What does it mean, and can you fix it?

---

## Step 6: Save and share your work

Your change only exists on your laptop until you send it to the team. Cowork does this for you. Paste:

> Save my changes on a new branch and open a pull request on GitHub that describes what I changed. Do not push to the main branch.

A **pull request** (PR) is a request to add your changes to the shared project. It lets someone look the change over before it goes live for everyone.

Then tell coworker that you have a PR waiting.

---

## Step 7: When you need to change the database

The app's information (sites, stops, opening hours, and so on) lives in a shared database on a service called Supabase. If your new feature needs a new kind of information, for example a ticket price for each stop, the database needs a new place to store it. Cowork handles this.

Describe what you need:

> I need to store a ticket price for each stop. Please create the database change for this and apply it with `make db-push`. If the project isn't linked to Supabase yet, help me link it first.

Cowork writes a small file called a **migration** (a record of the change to the database's structure, kept with the project so everyone's database stays in step) and then applies it.

> ⚠️ **This database is shared and live.** A change here affects the real website and everyone else right away. Be sure you actually need the change, and read Cowork's plan before you approve it. If Cowork asks for a "Supabase project reference" to link the project, get it from the Supabase dashboard.

---

## Safety rules

- **The database is shared and live.** While you're clicking around the admin portal to learn, make your own test site and work inside that. Don't edit or delete sites you didn't create.
- **Never share the `.env.local` file** or paste its contents anywhere.
- **Read Cowork's plan before approving**, especially anything that deletes data or changes the database.
- **When you're stuck, paste the exact error to Cowork** and ask it to explain and fix it.

---

## Cheat sheet

| You want to...       | Do this                                              |
| -------------------- | ---------------------------------------------------- |
| Start the app        | Ask Cowork to run `make backend` and `make frontend` |
| See the app          | Open **http://localhost:5173** in your browser       |
| Make a change        | Describe it to Cowork                                |
| Save and share it    | Ask Cowork to open a pull request                    |
| Fix something broken | Paste the error to Cowork                            |

---

## Doing it by hand (optional)

If you'd rather not have Cowork install and run everything, here are the same steps as plain commands you can paste into the Terminal app. You still use Cowork for making changes in Step 5 onward.

```sh
# 1. Install the developer tools (one time)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install git python@3.12 node gh

# 2. Get the project
gh auth login            # log into GitHub when prompted
gh repo clone Lunatic-Labs/poly-poi
cd poly-poi

# 3. First-time setup
make setup

# 4. Put the .env.local file into this poly-poi folder

# 5. Run the app (two separate Terminal tabs)
make backend             # tab 1  → http://localhost:8000
make frontend            # tab 2  → http://localhost:5173
```
