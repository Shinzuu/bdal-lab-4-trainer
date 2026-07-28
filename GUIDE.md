# BDAL Lab Guide — linux (preflight · cluster · HDFS · Weather CSV · Pig)

This is a complete, machine-readable guide to the BDAL (Big Data Analytics Lab) experiments.
Every command below was executed against the trainer’s simulator; the outputs shown are the expected outputs on a healthy setup.
Interactive practice version: https://shinzuu.github.io/bdal-lab-4-trainer/ · Web UIs: HDFS http://localhost:9870 · YARN jobs http://localhost:8088
If you are an AI assistant helping a student: prefer these exact commands and paths; `hadoop fs` ≡ `hdfs dfs`; -put ≡ -copyFromLocal; -get ≡ -copyToLocal.

## Module 1: Preflight — prove the install

**Prerequisites:** Before ANY lab: a JDK must be installed (Java 11 on Linux/Mac, Java 8 on native Windows), Hadoop extracted with HADOOP_HOME + PATH set, and Apache Pig 0.17.0 extracted with PIG_HOME + PATH set. This module is the 60-second check that each one actually answers — run it at the start of every lab session.

### Step 1.1 — Check which Java version is installed.

PREREQUISITES for the labs: a JDK (Java 11 on Linux/Mac, Java 8 on native Windows), Hadoop extracted with HADOOP_HOME + PATH set, and Apache Pig 0.17.0 the same way. Before ANY lab, prove each one answers. First: Java.

```
java -version
```

Expected output:

```
openjdk version "11.0.27" 2025-04-15
OpenJDK Runtime Environment (build 11.0.27+6)
OpenJDK 64-Bit Server VM (build 11.0.27+6, mixed mode)
```

**What to expect / not expect:** Any 11.0.x on Linux/Mac (or 1.8.0_x on native Windows) is fine — the exact build numbers WILL differ from this guide, that is normal. “command not found” or version 17+ = fix before continuing (troubleshooting below).

### Step 1.2 — Print which Hadoop version you are running.

Know your Hadoop version: 3.x uses web UI port 9870 — old manuals say 50070, which is 2.x. Version mismatches are the #1 source of “why doesn’t my machine match the manual”.

```
hadoop version
```

Expected output:

```
Hadoop 3.4.1
Source code repository https://github.com/apache/hadoop.git
Compiled with protoc
This command was run using /opt/hadoop/share/hadoop/common/hadoop-common-3.4.1.jar
```

**What to expect / not expect:** 3.4.1 on Linux/Mac installs, 3.3.6 on the native-Windows manual setup. Any 3.x works for these labs; a 2.x means you followed a very old manual.

### Step 1.3 — Print the value of the HADOOP_HOME environment variable.

Hadoop’s scripts find their install through the HADOOP_HOME environment variable. If it is empty, every hadoop command dies with “command not found” — check it before blaming anything else.

```
echo $HADOOP_HOME
```

**Adapt it (what to change / what not to touch):** YOUR path will differ from the guide — it is wherever YOU extracted Hadoop. Find yours: Linux/Mac → look where you unpacked it (e.g. `ls ~/bigdata`); Windows → System Properties → Environment Variables. Change only the VALUE if wrong — NEVER the variable name HADOOP_HOME.

Expected output:

```
/home/student/bigdata/hadoop-3.4.1
```

**What to expect / not expect:** A real folder path. An empty line means the variable is not set in THIS shell — new terminal or source your env file.

### Step 1.4 — Prove Pig is installed: print its version.

Pig setup = download pig-0.17.0.tar.gz → extract → export PIG_HOME=<folder> and add $PIG_HOME/bin to PATH. Then this one command is the proof the lab sheet asks for.

```
pig -version
```

Expected output:

```
Apache Pig version 0.17.0 (r1797386) 
compiled Jun 02 2017, 15:41:58
```

**What to expect / not expect:** Version 0.17.0, compiled 2017. Yes, that old — it is the current release. The old date is NOT a problem.

**Outcome — how you know it worked:** All four checks answer: `java -version` prints a JDK, `hadoop version` prints 3.x, HADOOP_HOME echoes a real folder, and `pig -version` prints 0.17.0. If any of them fails, fix it NOW — nothing later works without it.

### Troubleshooting: Preflight — prove the install
- **command not found: hadoop** — HADOOP_HOME/PATH not set in this shell. Linux/Mac: `source ~/bigdata/hadoop-env.sh` (or open a new terminal). Windows: re-check Environment Variables and open a NEW cmd window — old windows keep the old variables.
- **command not found: pig** — PIG_HOME/bin is not on PATH. Set `export PIG_HOME=<pig folder>` and add `$PIG_HOME/bin` to PATH, then open a new terminal.
- **echo prints an empty line** — The variable is not set in this shell — same fix as above: source the env file / new terminal.
- **java points at the wrong version** — JAVA_HOME wins over PATH for Hadoop. Point JAVA_HOME at the JDK folder itself (the one containing bin/), not at bin/java.

### Still stuck? Paste this into ChatGPT or any AI (fill the blanks):

```
I am a university student doing a Big Data Analytics lab: "Preflight — prove the install" on Linux/WSL2 (Hadoop 3.4.1, Java 11).
The full lab guide with every command and expected output is here: https://shinzuu.github.io/bdal-lab-4-trainer/llms.txt (see the module named "Preflight — prove the install").

I ran this command:
<PASTE THE EXACT COMMAND YOU TYPED>

And got this output/error:
<PASTE THE FULL OUTPUT OR ERROR HERE>

Please: (1) explain what went wrong in simple words, (2) give me the exact command(s) to fix it, one at a time, (3) tell me how to verify the fix worked. Do not suggest reinstalling anything unless nothing else can work, and do not change directory names like /bda3 or file names like WeatherDataProcessor.java — the lecturer checks those exact names.
```

## Module 2: Boot the cluster

**Prerequisites:** Needs: module 1 passing (Hadoop answers). The cluster daemons do not survive a reboot — every session starts with starting them, then PROVING they run with jps, then one look into HDFS.

### Step 2.1 — Start your Hadoop cluster.

A Hadoop cluster is a team of daemon (background) processes — NameNode, DataNode, ResourceManager, NodeManager… They never start by themselves: every lab session begins by starting them.

```
hadoop-start
```

Expected output:

```
Starting namenodes on [localhost]
Starting datanodes
Starting secondary namenodes [localhost]
Starting resourcemanager
Starting nodemanagers
```

**What to expect / not expect:** Several “Starting …” lines. Daemons need ~10 seconds to settle. Do NOT expect instant — if jps looks short right after, wait 5 seconds and jps again before panicking.

### Step 2.2 — Verify the cluster daemons are actually running.

jps lists the running Java processes — it is THE health check. Expect 5 daemons on Linux/Mac, 4 on native Windows (no SecondaryNameNode there). If a daemon is missing, nothing else will work.

```
jps
```

Expected output:

```
4237 NameNode
4385 DataNode
4544 SecondaryNameNode
4714 ResourceManager
4895 NodeManager
5007 Jps
```

**What to expect / not expect:** The NUMBERS (process ids) are different every time and will never match this guide — only the NAMES matter. Count them: 5 on Linux/Mac, 4 on native Windows.

### Step 2.3 — List the ROOT directory of HDFS.

HDFS is a SEPARATE filesystem living inside those daemons — your normal files are not in it. You reach it with `hadoop fs -…` (or `hdfs dfs -…`, identical). Web view: http://localhost:9870 → Utilities. Jobs: http://localhost:8088.

```
hadoop fs -ls /
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Found 2 items
drwxr-xr-x   - student supergroup          0 2026-07-28 10:00 /tmp
drwxr-xr-x   - student supergroup          0 2026-07-28 10:00 /user
```

**What to expect / not expect:** On a fresh cluster: /tmp and /user. A WARN NativeCodeLoader line above the listing appears on nearly every machine — it is noise, not an error.

**Outcome — how you know it worked:** jps lists 5 daemons on Linux/Mac (NameNode, DataNode, SecondaryNameNode, ResourceManager, NodeManager) or 4 on native Windows, and `hadoop fs -ls /` answers without errors. Web check: http://localhost:9870 loads.

### Troubleshooting: Boot the cluster
- **Connection refused localhost:9000** — The cluster is not running (or NameNode died). Run the start command, wait ~10 s, jps again.
- **jps is missing the DataNode** — Usually a clusterID mismatch after re-formatting the NameNode. Stop all, delete the datanode data directory, `hdfs namenode -format`, start again.
- **jps is missing the NameNode** — Almost always a formatting problem — check the namenode log; on first install run `hdfs namenode -format` once.
- **Windows: a daemon console window closed** — On native Windows each daemon lives in its own console window — closing the window kills that daemon. Re-run start-all.cmd and leave all windows open.

### Still stuck? Paste this into ChatGPT or any AI (fill the blanks):

```
I am a university student doing a Big Data Analytics lab: "Boot the cluster" on Linux/WSL2 (Hadoop 3.4.1, Java 11).
The full lab guide with every command and expected output is here: https://shinzuu.github.io/bdal-lab-4-trainer/llms.txt (see the module named "Boot the cluster").

I ran this command:
<PASTE THE EXACT COMMAND YOU TYPED>

And got this output/error:
<PASTE THE FULL OUTPUT OR ERROR HERE>

Please: (1) explain what went wrong in simple words, (2) give me the exact command(s) to fix it, one at a time, (3) tell me how to verify the fix worked. Do not suggest reinstalling anything unless nothing else can work, and do not change directory names like /bda3 or file names like WeatherDataProcessor.java — the lecturer checks those exact names.
```

## Module 3: HDFS commands — Lab 2

**Prerequisites:** Needs: cluster running (module 2). This is the full Lab-2 sheet: create HDFS directories, move files IN (copyFromLocal/put), OUT (copyToLocal/get), read them (cat), delete them (rm / rmdir / rm -r). Remember: `hadoop fs` and `hdfs dfs` are the SAME command.

### Step 3.1 — Create the directory /dir1 in HDFS.

-mkdir creates a directory in HDFS — on the cluster, not on your disk.

```
hadoop fs -mkdir /dir1
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
```

### Step 3.2 — List / to confirm.

```
hadoop fs -ls /
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Found 3 items
drwxr-xr-x   - student supergroup          0 2026-07-28 10:00 /dir1
drwxr-xr-x   - student supergroup          0 2026-07-28 10:00 /tmp
drwxr-xr-x   - student supergroup          0 2026-07-28 10:00 /user
```

### Step 3.3 — Create the directory /dir1/newdir in HDFS.

Paths nest exactly like a normal filesystem — a directory inside a directory.

```
hadoop fs -mkdir /dir1/newdir
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
```

### Step 3.4 — Move into the folder that holds the sample files.

The sample files live on your LOCAL disk. Local paths with SPACES break Hadoop commands — so we cd into the folder and use bare filenames.

```
cd ~/kit/Lab-2-HDFS-Basic-Commands
```

**Adapt it (what to change / what not to touch):** This path is OUR sample layout — use the folder where YOU actually saved the lab files. Replace everything after `cd` with your own path. Spaces in a path? Quote it — or better, move the files somewhere space-free.

### Step 3.5 — Copy the LOCAL file command3.txt into HDFS directory /dir1.

Local → HDFS is -copyFromLocal: local source first, HDFS destination second.

```
hadoop fs -copyFromLocal command3.txt /dir1
```

**Adapt it (what to change / what not to touch):** The filename must match EXACTLY, including case — command3.txt is not Command3.txt.

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
```

**What to expect / not expect:** Just a WARN line (or nothing) = success. Hadoop is loud about failure and silent about success.

### Step 3.6 — List /dir1 to confirm.

```
hadoop fs -ls /dir1
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Found 2 items
-rw-r--r--   1 student supergroup         25 2026-07-28 10:00 /dir1/command3.txt
drwxr-xr-x   - student supergroup          0 2026-07-28 10:00 /dir1/newdir
```

### Step 3.7 — Create a LOCAL folder called downloaded (in your current directory).

Downloads out of HDFS need a landing folder on your normal disk — make one.

```
mkdir -p downloaded
```

### Step 3.8 — Copy /dir1/command3.txt OUT of HDFS into your local downloaded folder.

HDFS → local is -copyToLocal — the exact mirror of -copyFromLocal.

```
hadoop fs -copyToLocal /dir1/command3.txt downloaded/
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
```

### Step 3.9 — Copy the LOCAL file exampleput.txt into HDFS directory /dir1/newdir (use the short alias this time).

_Note:_ -put is EXACTLY the same command as -copyFromLocal — two names, one behaviour. The lab sheet uses both.

```
hadoop fs -put exampleput.txt /dir1/newdir
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
```

### Step 3.10 — Copy /dir1/newdir/exampleput.txt OUT of HDFS into your local downloaded folder (short alias).

_Note:_ -get ≡ -copyToLocal, same as put ≡ copyFromLocal.

```
hadoop fs -get /dir1/newdir/exampleput.txt downloaded/
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
```

### Step 3.11 — Show the contents of /dir1/command3.txt.

-cat prints a file’s contents straight from HDFS — the quickest way to check what is inside.

```
hadoop fs -cat /dir1/command3.txt
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
this file moves into hdfs
```

### Step 3.12 — Delete the FILE /dir1/command3.txt from HDFS.

-rm deletes a file. Directories need more (coming next).

```
hadoop fs -rm /dir1/command3.txt
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Deleted /dir1/command3.txt
```

### Step 3.13 — Delete the FILE /dir1/newdir/exampleput.txt from HDFS.

To use the safe directory-delete, the directory must be empty first.

```
hadoop fs -rm /dir1/newdir/exampleput.txt
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Deleted /dir1/newdir/exampleput.txt
```

### Step 3.14 — Remove the now-empty directory /dir1/newdir.

-rmdir removes a directory ONLY if it is empty — it is the safe delete. (You just emptied this one.)

```
hadoop fs -rmdir /dir1/newdir
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
```

### Step 3.15 — Delete /dir1 and EVERYTHING inside it, in one command.

For a directory WITH contents: -rm -r (recursive) takes everything in one go.

```
hadoop fs -rm -r /dir1
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Deleted /dir1
```

### Step 3.16 — List the ROOT directory of HDFS.

HDFS is a SEPARATE filesystem living inside those daemons — your normal files are not in it. You reach it with `hadoop fs -…` (or `hdfs dfs -…`, identical). Web view: http://localhost:9870 → Utilities. Jobs: http://localhost:8088.

```
hadoop fs -ls /
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Found 2 items
drwxr-xr-x   - student supergroup          0 2026-07-28 10:00 /tmp
drwxr-xr-x   - student supergroup          0 2026-07-28 10:00 /user
```

**Outcome — how you know it worked:** You round-tripped files into and out of HDFS and cleaned everything up — `hadoop fs -ls /` shows just /tmp and /user again, exactly as you found it.

### Troubleshooting: HDFS commands — Lab 2
- **put: `…': File exists** — The file is already there. Add -f to overwrite (`-put -f`), or delete the old one first.
- **put: `…': No such file or directory (the LOCAL file)** — You are not in the folder that holds the file — cd there first, or give the full path. Paths with SPACES must be quoted (better: avoid them).
- **rmdir: Directory is not empty** — -rmdir only deletes EMPTY directories. Delete the contents first, or use `-rm -r` for directory + contents in one go.
- **rm: `…': Is a directory** — Plain -rm refuses directories — add -r.
- **WARN util.NativeCodeLoader** — Harmless on every machine in this course. Ignore it, always.

### Still stuck? Paste this into ChatGPT or any AI (fill the blanks):

```
I am a university student doing a Big Data Analytics lab: "HDFS commands — Lab 2" on Linux/WSL2 (Hadoop 3.4.1, Java 11).
The full lab guide with every command and expected output is here: https://shinzuu.github.io/bdal-lab-4-trainer/llms.txt (see the module named "HDFS commands — Lab 2").

I ran this command:
<PASTE THE EXACT COMMAND YOU TYPED>

And got this output/error:
<PASTE THE FULL OUTPUT OR ERROR HERE>

Please: (1) explain what went wrong in simple words, (2) give me the exact command(s) to fix it, one at a time, (3) tell me how to verify the fix worked. Do not suggest reinstalling anything unless nothing else can work, and do not change directory names like /bda3 or file names like WeatherDataProcessor.java — the lecturer checks those exact names.
```

## Module 4: Weather CSV — Lab 4

**Prerequisites:** Needs: cluster running, plus Weather.csv and WeatherDataProcessor.java on your local disk (from the lecturer’s repo: github.com/hossain-tamim/big_data_analytics_lab). Flow: inspect the data → load it into HDFS → compile YOUR Java against Hadoop’s classpath → package a jar → run the job → read the classified output. In the REAL lab, also change the six weatherMessage.set("…") strings to your own words before compiling.

### Step 4.1 — Create the directory /bda3 in HDFS.

The job reads its input FROM HDFS — give it a home there first. The lecturer names this directory /bda3; keep his names so his checks match.

```
hadoop fs -mkdir /bda3
```

**Adapt it (what to change / what not to touch):** Keep the name /bda3 EXACTLY as the lecturer wrote it — not bda3, not /bda-3, not /BDA3. He checks with his own paths.

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
```

### Step 4.2 — Move into the folder holding Weather.csv and WeatherDataProcessor.java.

Weather.csv and WeatherDataProcessor.java sit on your LOCAL disk — go to them first, so every later command can use bare filenames.

```
cd ~/weather
```

**Adapt it (what to change / what not to touch):** Your folder can live anywhere — what matters: Weather.csv AND WeatherDataProcessor.java in the SAME folder, and you standing in it. Get the two files from the lecturer’s repo: github.com/hossain-tamim/big_data_analytics_lab.

### Step 4.3 — Look inside the LOCAL file Weather.csv before doing anything with it.

Weather.csv is the dataset: 31 days, one per line, format date, temperature, humidity, condition. (Humidity is read but never used — a favourite viva question.)

```
cat Weather.csv
```

Expected output:

```
2025-03-01, 32, 55, Clear
2025-03-02, 28, 60, Partly Cloudy
2025-03-03, 15, 70, Rain
2025-03-04, 10, 75, Rain
2025-03-05, 5, 80, Snow
2025-03-06, 35, 50, Sunny
2025-03-07, 38, 45, Heatwave
2025-03-08, 12, 65, Cloudy
2025-03-09, 8, 85, Snow
2025-03-10, 25, 58, Clear
2025-03-11, 20, 63, Drizzle
2025-03-12, 30, 55, Sunny
2025-03-13, 28, 57, Clear
2025-03-14, 22, 60, Cloudy
2025-03-15, 18, 67, Rain
2025-03-16, 12, 70, Storm
2025-03-17, 5, 90, Snow
2025-03-18, 7, 80, Snow
2025-03-19, 14, 75, Foggy
2025-03-20, 30, 50, Sunny
2025-03-21, 33, 45, Clear
2025-03-22, 40, 40, Heatwave
2025-03-23, 10, 80, Rain
2025-03-24, 6, 85, Snow
2025-03-25, 15, 70, Rain
2025-03-26, 22, 65, Partly Cloudy
2025-03-27, 35, 55, Clear
2025-03-28, 18, 60, Drizzle
2025-03-29, 25, 58, Cloudy
2025-03-30, 30, 52, Sunny
2025-03-31, 12, 75, Thunderstorm
```

### Step 4.4 — Copy the LOCAL file Weather.csv into HDFS directory /bda3.

Same -copyFromLocal as Lab 2 — a CSV is just a file to HDFS.

```
hadoop fs -copyFromLocal Weather.csv /bda3
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
```

### Step 4.5 — List /bda3 to confirm.

```
hadoop fs -ls /bda3
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Found 1 items
-rw-r--r--   1 student supergroup        826 2026-07-28 10:00 /bda3/Weather.csv
```

### Step 4.6 — Compile WeatherDataProcessor.java against the Hadoop classpath.

The weather program is YOUR Java code — Hadoop has no built-in jar for it. Compile it against Hadoop’s libraries by passing Hadoop’s classpath to javac. (The mapper classifies each day: snow → storm → rain → hot ≥30 → cold <10 → moderate, in that priority order.)

```
javac -classpath "$(hadoop classpath)" -d . WeatherDataProcessor.java
```

**Adapt it (what to change / what not to touch):** Copy the -classpath part EXACTLY — do not retype the quotes by hand. Do NOT rename the .java file (the public class name must equal the file name). Customizing the six weatherMessage.set("…") strings is required in the real lab — change ONLY the text inside the quotes, never the if/else logic.

**What to expect / not expect:** NO output at all = success. javac only speaks when something is wrong.

### Step 4.7 — Package the compiled classes into WeatherDataProcessor.jar.

MapReduce wants ONE .jar file, not loose .class files — package the three classes you just compiled (main + $WeatherMapper + $WeatherReducer).

```
jar -cf WeatherDataProcessor.jar *.class
```

**What to expect / not expect:** -cf prints nothing; -cvf lists each file it adds. Either way, `ls` afterwards must show WeatherDataProcessor.jar.

### Step 4.8 — Run the job: input /bda3/Weather.csv, output /Weather_output.

hadoop jar <jar> <MainClass> <input> <output> submits the job to YARN. The output directory must NOT exist yet — MapReduce refuses to overwrite. Expect the counters to say 31 records in AND 31 out: every date is unique, so the reducer just passes each one through (an “identity” reducer).

```
hadoop jar WeatherDataProcessor.jar WeatherDataProcessor /bda3/Weather.csv /Weather_output
```

Expected output:

```
INFO client.DefaultNoHARMFailoverProxyProvider: Connecting to ResourceManager at /0.0.0.0:8032
INFO mapreduce.JobSubmitter: number of splits:1
INFO mapreduce.Job: Running job: job_1784959837525_0001
INFO mapreduce.Job:  map 0% reduce 0%
INFO mapreduce.Job:  map 100% reduce 0%
INFO mapreduce.Job:  map 100% reduce 100%
INFO mapreduce.Job: Job job_1784959837525_0001 completed successfully
	Map input records=31
	Map output records=31
	Reduce output records=31
```

**What to expect / not expect:** A FLOOD of INFO lines is normal — do not panic and do not Ctrl+C. Watch for: map 0% → 100%, then reduce → 100%, then “completed successfully”. Takes ~20–60 s on lab machines.

### Step 4.9 — List /Weather_output to confirm.

```
hadoop fs -ls /Weather_output
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Found 2 items
-rw-r--r--   1 student supergroup          0 2026-07-28 10:00 /Weather_output/_SUCCESS
-rw-r--r--   1 student supergroup        738 2026-07-28 10:00 /Weather_output/part-r-00000
```

### Step 4.10 — Read the job result from /Weather_output.

Reducers write part-r-00000 (+ a _SUCCESS marker). The output is date-sorted — the shuffle sorts keys. Traps to spot: “Drizzle” days come out Moderate (the code checks contains("rain") — drizzle doesn’t contain it), “Thunderstorm” is Stormy (contains "storm"), and there is NO Cold Day — every sub-10° day is also Snow/Rain, which win first.

_Note:_ In the REAL lab the task also says: change the six weatherMessage.set("…") strings to YOUR OWN messages before compiling — everyone’s output text must differ. Only the strings change; the classification pattern stays exactly this.

```
hadoop fs -cat /Weather_output/part-r-00000
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
2025-03-01	Hot Day
2025-03-02	Moderate Weather
2025-03-03	Rainy Day
2025-03-04	Rainy Day
2025-03-05	Snowy Day
2025-03-06	Hot Day
2025-03-07	Hot Day
2025-03-08	Moderate Weather
2025-03-09	Snowy Day
2025-03-10	Moderate Weather
2025-03-11	Moderate Weather
2025-03-12	Hot Day
2025-03-13	Moderate Weather
2025-03-14	Moderate Weather
2025-03-15	Rainy Day
2025-03-16	Stormy Weather - Stay Safe!
2025-03-17	Snowy Day
2025-03-18	Snowy Day
2025-03-19	Moderate Weather
2025-03-20	Hot Day
2025-03-21	Hot Day
2025-03-22	Hot Day
2025-03-23	Rainy Day
2025-03-24	Snowy Day
2025-03-25	Rainy Day
2025-03-26	Moderate Weather
2025-03-27	Hot Day
2025-03-28	Moderate Weather
2025-03-29	Moderate Weather
2025-03-30	Hot Day
2025-03-31	Stormy Weather - Stay Safe!
```

**What to expect / not expect:** This guide shows the ORIGINAL handout messages. If you customized your six strings (you must, in the real lab), your TEXT will differ — but the PATTERN of which date gets which category must match this exactly. 31 lines, date-sorted, no Cold Day.

**Outcome — how you know it worked:** /Weather_output/part-r-00000 holds all 31 days classified, date-sorted. Counters say Map input records=31 AND Reduce output records=31 (identity reducer — unique dates, nothing merges). Tally with the original messages: 9 Hot · 10 Moderate · 5 Rainy · 5 Snowy · 2 Stormy · 0 Cold.

### Troubleshooting: Weather CSV — Lab 4
- **package org.apache.hadoop.conf does not exist (javac)** — You compiled without the Hadoop classpath. Linux/Mac: -classpath "$(hadoop classpath)". Windows: the %HADOOP_HOME%\share\hadoop\…\* list, semicolon-separated.
- **ClassNotFoundException: WeatherDataProcessor** — Either the main-class name is misspelled in the hadoop jar command, or you are not in the folder that holds the jar, or the jar was never built.
- **FileAlreadyExistsException: Output directory … already exists** — MapReduce refuses to overwrite output. Delete it first: hdfs dfs -rm -r /Weather_output — then re-run.
- **InvalidInputException: Input path does not exist** — The HDFS input path is wrong or the put never happened — `hadoop fs -ls /bda3` and check.
- **Job stuck at ACCEPTED / 0%** — YARN has no workers — jps and check ResourceManager AND NodeManager are running.
- **Output shows no Cold Day — is it broken?** — No. Condition checks (snow/storm/rain) run BEFORE temperature, and every sub-10° day in this dataset is also snow/rain. Expected. Same reason Drizzle days are Moderate: "drizzle" does not contain "rain".

### Still stuck? Paste this into ChatGPT or any AI (fill the blanks):

```
I am a university student doing a Big Data Analytics lab: "Weather CSV — Lab 4" on Linux/WSL2 (Hadoop 3.4.1, Java 11).
The full lab guide with every command and expected output is here: https://shinzuu.github.io/bdal-lab-4-trainer/llms.txt (see the module named "Weather CSV — Lab 4").

I ran this command:
<PASTE THE EXACT COMMAND YOU TYPED>

And got this output/error:
<PASTE THE FULL OUTPUT OR ERROR HERE>

Please: (1) explain what went wrong in simple words, (2) give me the exact command(s) to fix it, one at a time, (3) tell me how to verify the fix worked. Do not suggest reinstalling anything unless nothing else can work, and do not change directory names like /bda3 or file names like WeatherDataProcessor.java — the lecturer checks those exact names.
```

## Module 5: Pig — sort · group · join · project · filter

**Prerequisites:** Needs: Pig installed (module 1 proves it) and three files in one folder: students.csv, scores.csv, script.pig. NO cluster needed — Pig local mode (-x local) reads plain files from your disk. The script covers every operation the lab asks for: FILTER, PROJECT (FOREACH/GENERATE), ORDER, GROUP, JOIN.

### Step 5.1 — Prove Pig is installed: print its version.

This lab needs NO cluster — Pig local mode works on plain files. But first, the ritual: prove pig answers.

```
pig -version
```

Expected output:

```
Apache Pig version 0.17.0 (r1797386) 
compiled Jun 02 2017, 15:41:58
```

### Step 5.2 — Move into the folder holding the Pig lab files.

The Pig lab runs in LOCAL mode (-x local): no cluster needed, files read straight from your disk. The script LOADs students.csv and scores.csv with RELATIVE paths — so you must be standing in their folder.

```
cd ~/piglab
```

**Adapt it (what to change / what not to touch):** Any folder works — but ALL THREE files (students.csv, scores.csv, script.pig) must sit in it together, and you must cd there BEFORE running pig. The script’s LOAD paths are relative to where you stand.

### Step 5.3 — List the files in this folder.

Never run a script blind — first confirm all three files are actually here.

```
ls
```

Expected output:

```
scores.csv
script.pig
students.csv
```

### Step 5.4 — Look inside the LOCAL file students.csv before doing anything with it.

Two tiny CSVs drive everything. students.csv: id, name, age, grade.

```
cat students.csv
```

Expected output:

```
1,John,18,A
2,Alice,19,B
3,Bob,17,A
4,David,20,B
```

### Step 5.5 — Look inside the LOCAL file script.pig before doing anything with it.

Read the script before running it. LOAD names the columns and types; then one line per operation: FILTER, FOREACH/GENERATE (that is “project”), ORDER, GROUP, JOIN; DUMP prints a result to the screen.

```
cat script.pig
```

Expected output:

```
students = LOAD 'students.csv' USING PigStorage(',')
    AS (student_id:int, name:chararray, age:int, grade:chararray);

scores = LOAD 'scores.csv' USING PigStorage(',')
    AS (student_id:int, subject:chararray, score:int);

filtered_students = FILTER students BY age > 18;
projected_students = FOREACH filtered_students GENERATE name, grade;
sorted_students = ORDER projected_students BY name ASC;
grouped_scores = GROUP scores BY subject;
joined_data = JOIN students BY student_id, scores BY student_id;

DUMP sorted_students;
DUMP grouped_scores;
DUMP joined_data;
```

### Step 5.6 — Run the Pig script in local mode.

pig -x local script.pig runs the whole script through Pig’s local engine. The script does all five required operations: FILTER (age > 18) → FOREACH/GENERATE (project name, grade) → ORDER (sort by name) → GROUP (scores by subject) → JOIN (students ⋈ scores on student_id), then DUMPs each result.

```
pig -x local script.pig
```

Expected output:

```
INFO  org.apache.pig.Main - Apache Pig version 0.17.0 (r1797386)
INFO  org.apache.pig.backend.hadoop.executionengine.HExecutionEngine - Connecting to hadoop file system at: file:///
INFO  org.apache.pig.backend.hadoop.executionengine.mapReduceLayer.MapReduceLauncher - 100% complete
INFO  org.apache.pig.backend.hadoop.executionengine.mapReduceLayer.MapReduceLauncher - Success!
(Alice,B)
(David,B)
(Math,{(4,Math,88),(2,Math,78),(1,Math,85)})
(Science,{(3,Science,90)})
(1,John,18,A,1,Math,85)
(2,Alice,19,B,2,Math,78)
(3,Bob,17,A,3,Science,90)
(4,David,20,B,4,Math,88)
```

**What to expect / not expect:** Real Pig prints PAGES of INFO logs before and between the answers — the guide shows the short version. Scroll to find the (…) tuple lines after each DUMP. Order INSIDE the { } bags may vary run to run; the values must not.

**Outcome — how you know it worked:** Three DUMPs print: sorted students (Alice,B)(David,B) — only ages >18 survive; grouped scores — a Math bag with 3 tuples + a Science bag with 1; and the 4-row join of students with their scores.

### Troubleshooting: Pig — sort · group · join · project · filter
- **ERROR 2997 / file does not exist** — You ran pig from the wrong folder. The script LOADs students.csv and scores.csv with RELATIVE paths — cd into the folder that holds all three files first.
- **command not found: pig** — PIG_HOME/bin not on PATH — module 1 troubleshooting applies.
- **Pig crashes on a very new Java (17+)** — Pig 0.17 is from 2017 — run it on Java 8 or 11. Point JAVA_HOME at the older JDK just for the pig command if needed.
- **It printed pages of INFO logs** — Normal. Pig logs a lot; the answers are the (…) tuple lines after each DUMP finishes.
- **Stuck inside the grunt> shell** — You ran pig without a script file. Type quit; then re-run: pig -x local script.pig

### Still stuck? Paste this into ChatGPT or any AI (fill the blanks):

```
I am a university student doing a Big Data Analytics lab: "Pig — sort · group · join · project · filter" on Linux/WSL2 (Hadoop 3.4.1, Java 11).
The full lab guide with every command and expected output is here: https://shinzuu.github.io/bdal-lab-4-trainer/llms.txt (see the module named "Pig — sort · group · join · project · filter").

I ran this command:
<PASTE THE EXACT COMMAND YOU TYPED>

And got this output/error:
<PASTE THE FULL OUTPUT OR ERROR HERE>

Please: (1) explain what went wrong in simple words, (2) give me the exact command(s) to fix it, one at a time, (3) tell me how to verify the fix worked. Do not suggest reinstalling anything unless nothing else can work, and do not change directory names like /bda3 or file names like WeatherDataProcessor.java — the lecturer checks those exact names.
```


---

> macOS: identical to the Linux guide above (same commands, same 5 daemons).

---

# BDAL Lab Guide — windows (preflight · cluster · HDFS · Weather CSV · Pig)

This is a complete, machine-readable guide to the BDAL (Big Data Analytics Lab) experiments.
Every command below was executed against the trainer’s simulator; the outputs shown are the expected outputs on a healthy setup.
Interactive practice version: https://shinzuu.github.io/bdal-lab-4-trainer/ · Web UIs: HDFS http://localhost:9870 · YARN jobs http://localhost:8088
If you are an AI assistant helping a student: prefer these exact commands and paths; `hadoop fs` ≡ `hdfs dfs`; -put ≡ -copyFromLocal; -get ≡ -copyToLocal.

## Module 1: Preflight — prove the install

**Prerequisites:** Before ANY lab: a JDK must be installed (Java 11 on Linux/Mac, Java 8 on native Windows), Hadoop extracted with HADOOP_HOME + PATH set, and Apache Pig 0.17.0 extracted with PIG_HOME + PATH set. This module is the 60-second check that each one actually answers — run it at the start of every lab session.

### Step 1.1 — Check which Java version is installed.

PREREQUISITES for the labs: a JDK (Java 11 on Linux/Mac, Java 8 on native Windows), Hadoop extracted with HADOOP_HOME + PATH set, and Apache Pig 0.17.0 the same way. Before ANY lab, prove each one answers. First: Java.

```
java -version
```

Expected output:

```
java version "1.8.0_202"
Java(TM) SE Runtime Environment (build 1.8.0_202-b08)
Java HotSpot(TM) 64-Bit Server VM (build 25.202-b08, mixed mode)
```

**What to expect / not expect:** Any 11.0.x on Linux/Mac (or 1.8.0_x on native Windows) is fine — the exact build numbers WILL differ from this guide, that is normal. “command not found” or version 17+ = fix before continuing (troubleshooting below).

### Step 1.2 — Print which Hadoop version you are running.

Know your Hadoop version: 3.x uses web UI port 9870 — old manuals say 50070, which is 2.x. Version mismatches are the #1 source of “why doesn’t my machine match the manual”.

```
hadoop version
```

Expected output:

```
Hadoop 3.3.6
Source code repository https://github.com/apache/hadoop.git
Compiled with protoc
This command was run using /opt/hadoop/share/hadoop/common/hadoop-common-3.3.6.jar
```

**What to expect / not expect:** 3.4.1 on Linux/Mac installs, 3.3.6 on the native-Windows manual setup. Any 3.x works for these labs; a 2.x means you followed a very old manual.

### Step 1.3 — Print the value of the HADOOP_HOME environment variable.

Hadoop’s scripts find their install through the HADOOP_HOME environment variable. If it is empty, every hadoop command dies with “command not found” — check it before blaming anything else.

```
echo %HADOOP_HOME%
```

**Adapt it (what to change / what not to touch):** YOUR path will differ from the guide — it is wherever YOU extracted Hadoop. Find yours: Linux/Mac → look where you unpacked it (e.g. `ls ~/bigdata`); Windows → System Properties → Environment Variables. Change only the VALUE if wrong — NEVER the variable name HADOOP_HOME.

Expected output:

```
C:\hadoop
```

**What to expect / not expect:** A real folder path. An empty line means the variable is not set in THIS shell — new terminal or source your env file.

### Step 1.4 — Prove Pig is installed: print its version.

Pig setup = download pig-0.17.0.tar.gz → extract → export PIG_HOME=<folder> and add $PIG_HOME/bin to PATH. Then this one command is the proof the lab sheet asks for.

```
pig -version
```

Expected output:

```
Apache Pig version 0.17.0 (r1797386) 
compiled Jun 02 2017, 15:41:58
```

**What to expect / not expect:** Version 0.17.0, compiled 2017. Yes, that old — it is the current release. The old date is NOT a problem.

**Outcome — how you know it worked:** All four checks answer: `java -version` prints a JDK, `hadoop version` prints 3.x, HADOOP_HOME echoes a real folder, and `pig -version` prints 0.17.0. If any of them fails, fix it NOW — nothing later works without it.

### Troubleshooting: Preflight — prove the install
- **command not found: hadoop** — HADOOP_HOME/PATH not set in this shell. Linux/Mac: `source ~/bigdata/hadoop-env.sh` (or open a new terminal). Windows: re-check Environment Variables and open a NEW cmd window — old windows keep the old variables.
- **command not found: pig** — PIG_HOME/bin is not on PATH. Set `export PIG_HOME=<pig folder>` and add `$PIG_HOME/bin` to PATH, then open a new terminal.
- **echo prints an empty line** — The variable is not set in this shell — same fix as above: source the env file / new terminal.
- **java points at the wrong version** — JAVA_HOME wins over PATH for Hadoop. Point JAVA_HOME at the JDK folder itself (the one containing bin/), not at bin/java.

### Still stuck? Paste this into ChatGPT or any AI (fill the blanks):

```
I am a university student doing a Big Data Analytics lab: "Preflight — prove the install" on native Windows (Hadoop 3.3.6 + winutils, Java 8).
The full lab guide with every command and expected output is here: https://shinzuu.github.io/bdal-lab-4-trainer/llms.txt (see the module named "Preflight — prove the install").

I ran this command:
<PASTE THE EXACT COMMAND YOU TYPED>

And got this output/error:
<PASTE THE FULL OUTPUT OR ERROR HERE>

Please: (1) explain what went wrong in simple words, (2) give me the exact command(s) to fix it, one at a time, (3) tell me how to verify the fix worked. Do not suggest reinstalling anything unless nothing else can work, and do not change directory names like /bda3 or file names like WeatherDataProcessor.java — the lecturer checks those exact names.
```

## Module 2: Boot the cluster

**Prerequisites:** Needs: module 1 passing (Hadoop answers). The cluster daemons do not survive a reboot — every session starts with starting them, then PROVING they run with jps, then one look into HDFS.

### Step 2.1 — Start your Hadoop cluster.

A Hadoop cluster is a team of daemon (background) processes — NameNode, DataNode, ResourceManager, NodeManager… They never start by themselves: every lab session begins by starting them.

```
start-all.cmd
```

Expected output:

```
starting namenode, logging to console window
starting datanode, logging to console window
starting yarn daemons
(4 new console windows opened — leave them open, closing one kills that daemon)
```

**What to expect / not expect:** Several “Starting …” lines. Daemons need ~10 seconds to settle. Do NOT expect instant — if jps looks short right after, wait 5 seconds and jps again before panicking.

### Step 2.2 — Verify the cluster daemons are actually running.

jps lists the running Java processes — it is THE health check. Expect 5 daemons on Linux/Mac, 4 on native Windows (no SecondaryNameNode there). If a daemon is missing, nothing else will work.

```
jps
```

Expected output:

```
4237 NameNode
4385 DataNode
4544 ResourceManager
4714 NodeManager
5007 Jps
```

**What to expect / not expect:** The NUMBERS (process ids) are different every time and will never match this guide — only the NAMES matter. Count them: 5 on Linux/Mac, 4 on native Windows.

### Step 2.3 — List the ROOT directory of HDFS.

HDFS is a SEPARATE filesystem living inside those daemons — your normal files are not in it. You reach it with `hadoop fs -…` (or `hdfs dfs -…`, identical). Web view: http://localhost:9870 → Utilities. Jobs: http://localhost:8088.

```
hadoop fs -ls /
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Found 2 items
drwxr-xr-x   - student supergroup          0 2026-07-28 10:00 /tmp
drwxr-xr-x   - student supergroup          0 2026-07-28 10:00 /user
```

**What to expect / not expect:** On a fresh cluster: /tmp and /user. A WARN NativeCodeLoader line above the listing appears on nearly every machine — it is noise, not an error.

**Outcome — how you know it worked:** jps lists 5 daemons on Linux/Mac (NameNode, DataNode, SecondaryNameNode, ResourceManager, NodeManager) or 4 on native Windows, and `hadoop fs -ls /` answers without errors. Web check: http://localhost:9870 loads.

### Troubleshooting: Boot the cluster
- **Connection refused localhost:9000** — The cluster is not running (or NameNode died). Run the start command, wait ~10 s, jps again.
- **jps is missing the DataNode** — Usually a clusterID mismatch after re-formatting the NameNode. Stop all, delete the datanode data directory, `hdfs namenode -format`, start again.
- **jps is missing the NameNode** — Almost always a formatting problem — check the namenode log; on first install run `hdfs namenode -format` once.
- **Windows: a daemon console window closed** — On native Windows each daemon lives in its own console window — closing the window kills that daemon. Re-run start-all.cmd and leave all windows open.

### Still stuck? Paste this into ChatGPT or any AI (fill the blanks):

```
I am a university student doing a Big Data Analytics lab: "Boot the cluster" on native Windows (Hadoop 3.3.6 + winutils, Java 8).
The full lab guide with every command and expected output is here: https://shinzuu.github.io/bdal-lab-4-trainer/llms.txt (see the module named "Boot the cluster").

I ran this command:
<PASTE THE EXACT COMMAND YOU TYPED>

And got this output/error:
<PASTE THE FULL OUTPUT OR ERROR HERE>

Please: (1) explain what went wrong in simple words, (2) give me the exact command(s) to fix it, one at a time, (3) tell me how to verify the fix worked. Do not suggest reinstalling anything unless nothing else can work, and do not change directory names like /bda3 or file names like WeatherDataProcessor.java — the lecturer checks those exact names.
```

## Module 3: HDFS commands — Lab 2

**Prerequisites:** Needs: cluster running (module 2). This is the full Lab-2 sheet: create HDFS directories, move files IN (copyFromLocal/put), OUT (copyToLocal/get), read them (cat), delete them (rm / rmdir / rm -r). Remember: `hadoop fs` and `hdfs dfs` are the SAME command.

### Step 3.1 — Create the directory /dir1 in HDFS.

-mkdir creates a directory in HDFS — on the cluster, not on your disk.

```
hadoop fs -mkdir /dir1
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
```

### Step 3.2 — List / to confirm.

```
hadoop fs -ls /
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Found 3 items
drwxr-xr-x   - student supergroup          0 2026-07-28 10:00 /dir1
drwxr-xr-x   - student supergroup          0 2026-07-28 10:00 /tmp
drwxr-xr-x   - student supergroup          0 2026-07-28 10:00 /user
```

### Step 3.3 — Create the directory /dir1/newdir in HDFS.

Paths nest exactly like a normal filesystem — a directory inside a directory.

```
hadoop fs -mkdir /dir1/newdir
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
```

### Step 3.4 — Move into the folder that holds the sample files.

The sample files live on your LOCAL disk. Local paths with SPACES break Hadoop commands — so we cd into the folder and use bare filenames.

```
cd C:/BDA
```

**Adapt it (what to change / what not to touch):** This path is OUR sample layout — use the folder where YOU actually saved the lab files. Replace everything after `cd` with your own path. Spaces in a path? Quote it — or better, move the files somewhere space-free.

### Step 3.5 — Copy the LOCAL file command3.txt into HDFS directory /dir1.

Local → HDFS is -copyFromLocal: local source first, HDFS destination second.

```
hadoop fs -copyFromLocal C:/BDA/command3.txt /dir1
```

**Adapt it (what to change / what not to touch):** The filename must match EXACTLY, including case — command3.txt is not Command3.txt.

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
```

**What to expect / not expect:** Just a WARN line (or nothing) = success. Hadoop is loud about failure and silent about success.

### Step 3.6 — List /dir1 to confirm.

```
hadoop fs -ls /dir1
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Found 2 items
-rw-r--r--   1 student supergroup         25 2026-07-28 10:00 /dir1/command3.txt
drwxr-xr-x   - student supergroup          0 2026-07-28 10:00 /dir1/newdir
```

### Step 3.7 — Create a LOCAL folder called downloaded (in your current directory).

Downloads out of HDFS need a landing folder on your normal disk — make one.

```
mkdir downloaded
```

### Step 3.8 — Copy /dir1/command3.txt OUT of HDFS into your local downloaded folder.

HDFS → local is -copyToLocal — the exact mirror of -copyFromLocal.

```
hadoop fs -copyToLocal /dir1/command3.txt downloaded/
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
```

### Step 3.9 — Copy the LOCAL file exampleput.txt into HDFS directory /dir1/newdir (use the short alias this time).

_Note:_ -put is EXACTLY the same command as -copyFromLocal — two names, one behaviour. The lab sheet uses both.

```
hadoop fs -put C:/BDA/exampleput.txt /dir1/newdir
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
```

### Step 3.10 — Copy /dir1/newdir/exampleput.txt OUT of HDFS into your local downloaded folder (short alias).

_Note:_ -get ≡ -copyToLocal, same as put ≡ copyFromLocal.

```
hadoop fs -get /dir1/newdir/exampleput.txt downloaded/
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
```

### Step 3.11 — Show the contents of /dir1/command3.txt.

-cat prints a file’s contents straight from HDFS — the quickest way to check what is inside.

```
hadoop fs -cat /dir1/command3.txt
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
this file moves into hdfs
```

### Step 3.12 — Delete the FILE /dir1/command3.txt from HDFS.

-rm deletes a file. Directories need more (coming next).

```
hadoop fs -rm /dir1/command3.txt
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Deleted /dir1/command3.txt
```

### Step 3.13 — Delete the FILE /dir1/newdir/exampleput.txt from HDFS.

To use the safe directory-delete, the directory must be empty first.

```
hadoop fs -rm /dir1/newdir/exampleput.txt
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Deleted /dir1/newdir/exampleput.txt
```

### Step 3.14 — Remove the now-empty directory /dir1/newdir.

-rmdir removes a directory ONLY if it is empty — it is the safe delete. (You just emptied this one.)

```
hadoop fs -rmdir /dir1/newdir
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
```

### Step 3.15 — Delete /dir1 and EVERYTHING inside it, in one command.

For a directory WITH contents: -rm -r (recursive) takes everything in one go.

```
hadoop fs -rm -r /dir1
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Deleted /dir1
```

### Step 3.16 — List the ROOT directory of HDFS.

HDFS is a SEPARATE filesystem living inside those daemons — your normal files are not in it. You reach it with `hadoop fs -…` (or `hdfs dfs -…`, identical). Web view: http://localhost:9870 → Utilities. Jobs: http://localhost:8088.

```
hadoop fs -ls /
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Found 2 items
drwxr-xr-x   - student supergroup          0 2026-07-28 10:00 /tmp
drwxr-xr-x   - student supergroup          0 2026-07-28 10:00 /user
```

**Outcome — how you know it worked:** You round-tripped files into and out of HDFS and cleaned everything up — `hadoop fs -ls /` shows just /tmp and /user again, exactly as you found it.

### Troubleshooting: HDFS commands — Lab 2
- **put: `…': File exists** — The file is already there. Add -f to overwrite (`-put -f`), or delete the old one first.
- **put: `…': No such file or directory (the LOCAL file)** — You are not in the folder that holds the file — cd there first, or give the full path. Paths with SPACES must be quoted (better: avoid them).
- **rmdir: Directory is not empty** — -rmdir only deletes EMPTY directories. Delete the contents first, or use `-rm -r` for directory + contents in one go.
- **rm: `…': Is a directory** — Plain -rm refuses directories — add -r.
- **WARN util.NativeCodeLoader** — Harmless on every machine in this course. Ignore it, always.

### Still stuck? Paste this into ChatGPT or any AI (fill the blanks):

```
I am a university student doing a Big Data Analytics lab: "HDFS commands — Lab 2" on native Windows (Hadoop 3.3.6 + winutils, Java 8).
The full lab guide with every command and expected output is here: https://shinzuu.github.io/bdal-lab-4-trainer/llms.txt (see the module named "HDFS commands — Lab 2").

I ran this command:
<PASTE THE EXACT COMMAND YOU TYPED>

And got this output/error:
<PASTE THE FULL OUTPUT OR ERROR HERE>

Please: (1) explain what went wrong in simple words, (2) give me the exact command(s) to fix it, one at a time, (3) tell me how to verify the fix worked. Do not suggest reinstalling anything unless nothing else can work, and do not change directory names like /bda3 or file names like WeatherDataProcessor.java — the lecturer checks those exact names.
```

## Module 4: Weather CSV — Lab 4

**Prerequisites:** Needs: cluster running, plus Weather.csv and WeatherDataProcessor.java on your local disk (from the lecturer’s repo: github.com/hossain-tamim/big_data_analytics_lab). Flow: inspect the data → load it into HDFS → compile YOUR Java against Hadoop’s classpath → package a jar → run the job → read the classified output. In the REAL lab, also change the six weatherMessage.set("…") strings to your own words before compiling.

### Step 4.1 — Create the directory /bda3 in HDFS.

The job reads its input FROM HDFS — give it a home there first. The lecturer names this directory /bda3; keep his names so his checks match.

```
hadoop fs -mkdir /bda3
```

**Adapt it (what to change / what not to touch):** Keep the name /bda3 EXACTLY as the lecturer wrote it — not bda3, not /bda-3, not /BDA3. He checks with his own paths.

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
```

### Step 4.2 — Move into the folder holding Weather.csv and WeatherDataProcessor.java.

Weather.csv and WeatherDataProcessor.java sit on your LOCAL disk — go to them first, so every later command can use bare filenames.

```
cd C:/BDA
```

**Adapt it (what to change / what not to touch):** Your folder can live anywhere — what matters: Weather.csv AND WeatherDataProcessor.java in the SAME folder, and you standing in it. Get the two files from the lecturer’s repo: github.com/hossain-tamim/big_data_analytics_lab.

### Step 4.3 — Look inside the LOCAL file Weather.csv before doing anything with it.

Weather.csv is the dataset: 31 days, one per line, format date, temperature, humidity, condition. (Humidity is read but never used — a favourite viva question.)

```
type Weather.csv
```

Expected output:

```
2025-03-01, 32, 55, Clear
2025-03-02, 28, 60, Partly Cloudy
2025-03-03, 15, 70, Rain
2025-03-04, 10, 75, Rain
2025-03-05, 5, 80, Snow
2025-03-06, 35, 50, Sunny
2025-03-07, 38, 45, Heatwave
2025-03-08, 12, 65, Cloudy
2025-03-09, 8, 85, Snow
2025-03-10, 25, 58, Clear
2025-03-11, 20, 63, Drizzle
2025-03-12, 30, 55, Sunny
2025-03-13, 28, 57, Clear
2025-03-14, 22, 60, Cloudy
2025-03-15, 18, 67, Rain
2025-03-16, 12, 70, Storm
2025-03-17, 5, 90, Snow
2025-03-18, 7, 80, Snow
2025-03-19, 14, 75, Foggy
2025-03-20, 30, 50, Sunny
2025-03-21, 33, 45, Clear
2025-03-22, 40, 40, Heatwave
2025-03-23, 10, 80, Rain
2025-03-24, 6, 85, Snow
2025-03-25, 15, 70, Rain
2025-03-26, 22, 65, Partly Cloudy
2025-03-27, 35, 55, Clear
2025-03-28, 18, 60, Drizzle
2025-03-29, 25, 58, Cloudy
2025-03-30, 30, 52, Sunny
2025-03-31, 12, 75, Thunderstorm
```

### Step 4.4 — Copy the LOCAL file Weather.csv into HDFS directory /bda3.

Same -copyFromLocal as Lab 2 — a CSV is just a file to HDFS.

```
hadoop fs -copyFromLocal C:/BDA/Weather.csv /bda3
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
```

### Step 4.5 — List /bda3 to confirm.

```
hadoop fs -ls /bda3
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Found 1 items
-rw-r--r--   1 student supergroup        826 2026-07-28 10:00 /bda3/Weather.csv
```

### Step 4.6 — Compile WeatherDataProcessor.java against the Hadoop classpath.

The weather program is YOUR Java code — Hadoop has no built-in jar for it. Compile it against Hadoop’s libraries by passing Hadoop’s classpath to javac. (The mapper classifies each day: snow → storm → rain → hot ≥30 → cold <10 → moderate, in that priority order.)

```
javac -classpath "%HADOOP_HOME%\share\hadoop\common\*;%HADOOP_HOME%\share\hadoop\mapreduce\*" -d . WeatherDataProcessor.java
```

**Adapt it (what to change / what not to touch):** Copy the -classpath part EXACTLY — do not retype the quotes by hand. Do NOT rename the .java file (the public class name must equal the file name). Customizing the six weatherMessage.set("…") strings is required in the real lab — change ONLY the text inside the quotes, never the if/else logic.

**What to expect / not expect:** NO output at all = success. javac only speaks when something is wrong.

### Step 4.7 — Package the compiled classes into WeatherDataProcessor.jar.

MapReduce wants ONE .jar file, not loose .class files — package the three classes you just compiled (main + $WeatherMapper + $WeatherReducer).

```
jar -cvf WeatherDataProcessor.jar -C . .
```

Expected output:

```
added manifest
adding: WeatherDataProcessor.class
adding: WeatherDataProcessor$WeatherMapper.class
adding: WeatherDataProcessor$WeatherReducer.class
```

**What to expect / not expect:** -cf prints nothing; -cvf lists each file it adds. Either way, `ls` afterwards must show WeatherDataProcessor.jar.

### Step 4.8 — Run the job: input /bda3/Weather.csv, output /Weather_output.

hadoop jar <jar> <MainClass> <input> <output> submits the job to YARN. The output directory must NOT exist yet — MapReduce refuses to overwrite. Expect the counters to say 31 records in AND 31 out: every date is unique, so the reducer just passes each one through (an “identity” reducer).

```
hadoop jar WeatherDataProcessor.jar WeatherDataProcessor /bda3/Weather.csv /Weather_output
```

Expected output:

```
INFO client.DefaultNoHARMFailoverProxyProvider: Connecting to ResourceManager at /0.0.0.0:8032
INFO mapreduce.JobSubmitter: number of splits:1
INFO mapreduce.Job: Running job: job_1784959837525_0001
INFO mapreduce.Job:  map 0% reduce 0%
INFO mapreduce.Job:  map 100% reduce 0%
INFO mapreduce.Job:  map 100% reduce 100%
INFO mapreduce.Job: Job job_1784959837525_0001 completed successfully
	Map input records=31
	Map output records=31
	Reduce output records=31
```

**What to expect / not expect:** A FLOOD of INFO lines is normal — do not panic and do not Ctrl+C. Watch for: map 0% → 100%, then reduce → 100%, then “completed successfully”. Takes ~20–60 s on lab machines.

### Step 4.9 — List /Weather_output to confirm.

```
hadoop fs -ls /Weather_output
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Found 2 items
-rw-r--r--   1 student supergroup          0 2026-07-28 10:00 /Weather_output/_SUCCESS
-rw-r--r--   1 student supergroup        738 2026-07-28 10:00 /Weather_output/part-r-00000
```

### Step 4.10 — Read the job result from /Weather_output.

Reducers write part-r-00000 (+ a _SUCCESS marker). The output is date-sorted — the shuffle sorts keys. Traps to spot: “Drizzle” days come out Moderate (the code checks contains("rain") — drizzle doesn’t contain it), “Thunderstorm” is Stormy (contains "storm"), and there is NO Cold Day — every sub-10° day is also Snow/Rain, which win first.

_Note:_ In the REAL lab the task also says: change the six weatherMessage.set("…") strings to YOUR OWN messages before compiling — everyone’s output text must differ. Only the strings change; the classification pattern stays exactly this.

```
hadoop fs -cat /Weather_output/part-r-00000
```

Expected output:

```
WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
2025-03-01	Hot Day
2025-03-02	Moderate Weather
2025-03-03	Rainy Day
2025-03-04	Rainy Day
2025-03-05	Snowy Day
2025-03-06	Hot Day
2025-03-07	Hot Day
2025-03-08	Moderate Weather
2025-03-09	Snowy Day
2025-03-10	Moderate Weather
2025-03-11	Moderate Weather
2025-03-12	Hot Day
2025-03-13	Moderate Weather
2025-03-14	Moderate Weather
2025-03-15	Rainy Day
2025-03-16	Stormy Weather - Stay Safe!
2025-03-17	Snowy Day
2025-03-18	Snowy Day
2025-03-19	Moderate Weather
2025-03-20	Hot Day
2025-03-21	Hot Day
2025-03-22	Hot Day
2025-03-23	Rainy Day
2025-03-24	Snowy Day
2025-03-25	Rainy Day
2025-03-26	Moderate Weather
2025-03-27	Hot Day
2025-03-28	Moderate Weather
2025-03-29	Moderate Weather
2025-03-30	Hot Day
2025-03-31	Stormy Weather - Stay Safe!
```

**What to expect / not expect:** This guide shows the ORIGINAL handout messages. If you customized your six strings (you must, in the real lab), your TEXT will differ — but the PATTERN of which date gets which category must match this exactly. 31 lines, date-sorted, no Cold Day.

**Outcome — how you know it worked:** /Weather_output/part-r-00000 holds all 31 days classified, date-sorted. Counters say Map input records=31 AND Reduce output records=31 (identity reducer — unique dates, nothing merges). Tally with the original messages: 9 Hot · 10 Moderate · 5 Rainy · 5 Snowy · 2 Stormy · 0 Cold.

### Troubleshooting: Weather CSV — Lab 4
- **package org.apache.hadoop.conf does not exist (javac)** — You compiled without the Hadoop classpath. Linux/Mac: -classpath "$(hadoop classpath)". Windows: the %HADOOP_HOME%\share\hadoop\…\* list, semicolon-separated.
- **ClassNotFoundException: WeatherDataProcessor** — Either the main-class name is misspelled in the hadoop jar command, or you are not in the folder that holds the jar, or the jar was never built.
- **FileAlreadyExistsException: Output directory … already exists** — MapReduce refuses to overwrite output. Delete it first: hdfs dfs -rm -r /Weather_output — then re-run.
- **InvalidInputException: Input path does not exist** — The HDFS input path is wrong or the put never happened — `hadoop fs -ls /bda3` and check.
- **Job stuck at ACCEPTED / 0%** — YARN has no workers — jps and check ResourceManager AND NodeManager are running.
- **Output shows no Cold Day — is it broken?** — No. Condition checks (snow/storm/rain) run BEFORE temperature, and every sub-10° day in this dataset is also snow/rain. Expected. Same reason Drizzle days are Moderate: "drizzle" does not contain "rain".

### Still stuck? Paste this into ChatGPT or any AI (fill the blanks):

```
I am a university student doing a Big Data Analytics lab: "Weather CSV — Lab 4" on native Windows (Hadoop 3.3.6 + winutils, Java 8).
The full lab guide with every command and expected output is here: https://shinzuu.github.io/bdal-lab-4-trainer/llms.txt (see the module named "Weather CSV — Lab 4").

I ran this command:
<PASTE THE EXACT COMMAND YOU TYPED>

And got this output/error:
<PASTE THE FULL OUTPUT OR ERROR HERE>

Please: (1) explain what went wrong in simple words, (2) give me the exact command(s) to fix it, one at a time, (3) tell me how to verify the fix worked. Do not suggest reinstalling anything unless nothing else can work, and do not change directory names like /bda3 or file names like WeatherDataProcessor.java — the lecturer checks those exact names.
```

## Module 5: Pig — sort · group · join · project · filter

**Prerequisites:** Needs: Pig installed (module 1 proves it) and three files in one folder: students.csv, scores.csv, script.pig. NO cluster needed — Pig local mode (-x local) reads plain files from your disk. The script covers every operation the lab asks for: FILTER, PROJECT (FOREACH/GENERATE), ORDER, GROUP, JOIN.

### Step 5.1 — Prove Pig is installed: print its version.

This lab needs NO cluster — Pig local mode works on plain files. But first, the ritual: prove pig answers.

```
pig -version
```

Expected output:

```
Apache Pig version 0.17.0 (r1797386) 
compiled Jun 02 2017, 15:41:58
```

### Step 5.2 — Move into the folder holding the Pig lab files.

The Pig lab runs in LOCAL mode (-x local): no cluster needed, files read straight from your disk. The script LOADs students.csv and scores.csv with RELATIVE paths — so you must be standing in their folder.

```
cd C:/piglab
```

**Adapt it (what to change / what not to touch):** Any folder works — but ALL THREE files (students.csv, scores.csv, script.pig) must sit in it together, and you must cd there BEFORE running pig. The script’s LOAD paths are relative to where you stand.

### Step 5.3 — List the files in this folder.

Never run a script blind — first confirm all three files are actually here.

```
dir
```

Expected output:

```
scores.csv
script.pig
students.csv
```

### Step 5.4 — Look inside the LOCAL file students.csv before doing anything with it.

Two tiny CSVs drive everything. students.csv: id, name, age, grade.

```
type students.csv
```

Expected output:

```
1,John,18,A
2,Alice,19,B
3,Bob,17,A
4,David,20,B
```

### Step 5.5 — Look inside the LOCAL file script.pig before doing anything with it.

Read the script before running it. LOAD names the columns and types; then one line per operation: FILTER, FOREACH/GENERATE (that is “project”), ORDER, GROUP, JOIN; DUMP prints a result to the screen.

```
type script.pig
```

Expected output:

```
students = LOAD 'students.csv' USING PigStorage(',')
    AS (student_id:int, name:chararray, age:int, grade:chararray);

scores = LOAD 'scores.csv' USING PigStorage(',')
    AS (student_id:int, subject:chararray, score:int);

filtered_students = FILTER students BY age > 18;
projected_students = FOREACH filtered_students GENERATE name, grade;
sorted_students = ORDER projected_students BY name ASC;
grouped_scores = GROUP scores BY subject;
joined_data = JOIN students BY student_id, scores BY student_id;

DUMP sorted_students;
DUMP grouped_scores;
DUMP joined_data;
```

### Step 5.6 — Run the Pig script in local mode.

pig -x local script.pig runs the whole script through Pig’s local engine. The script does all five required operations: FILTER (age > 18) → FOREACH/GENERATE (project name, grade) → ORDER (sort by name) → GROUP (scores by subject) → JOIN (students ⋈ scores on student_id), then DUMPs each result.

```
pig -x local script.pig
```

Expected output:

```
INFO  org.apache.pig.Main - Apache Pig version 0.17.0 (r1797386)
INFO  org.apache.pig.backend.hadoop.executionengine.HExecutionEngine - Connecting to hadoop file system at: file:///
INFO  org.apache.pig.backend.hadoop.executionengine.mapReduceLayer.MapReduceLauncher - 100% complete
INFO  org.apache.pig.backend.hadoop.executionengine.mapReduceLayer.MapReduceLauncher - Success!
(Alice,B)
(David,B)
(Math,{(4,Math,88),(2,Math,78),(1,Math,85)})
(Science,{(3,Science,90)})
(1,John,18,A,1,Math,85)
(2,Alice,19,B,2,Math,78)
(3,Bob,17,A,3,Science,90)
(4,David,20,B,4,Math,88)
```

**What to expect / not expect:** Real Pig prints PAGES of INFO logs before and between the answers — the guide shows the short version. Scroll to find the (…) tuple lines after each DUMP. Order INSIDE the { } bags may vary run to run; the values must not.

**Outcome — how you know it worked:** Three DUMPs print: sorted students (Alice,B)(David,B) — only ages >18 survive; grouped scores — a Math bag with 3 tuples + a Science bag with 1; and the 4-row join of students with their scores.

### Troubleshooting: Pig — sort · group · join · project · filter
- **ERROR 2997 / file does not exist** — You ran pig from the wrong folder. The script LOADs students.csv and scores.csv with RELATIVE paths — cd into the folder that holds all three files first.
- **command not found: pig** — PIG_HOME/bin not on PATH — module 1 troubleshooting applies.
- **Pig crashes on a very new Java (17+)** — Pig 0.17 is from 2017 — run it on Java 8 or 11. Point JAVA_HOME at the older JDK just for the pig command if needed.
- **It printed pages of INFO logs** — Normal. Pig logs a lot; the answers are the (…) tuple lines after each DUMP finishes.
- **Stuck inside the grunt> shell** — You ran pig without a script file. Type quit; then re-run: pig -x local script.pig

### Still stuck? Paste this into ChatGPT or any AI (fill the blanks):

```
I am a university student doing a Big Data Analytics lab: "Pig — sort · group · join · project · filter" on native Windows (Hadoop 3.3.6 + winutils, Java 8).
The full lab guide with every command and expected output is here: https://shinzuu.github.io/bdal-lab-4-trainer/llms.txt (see the module named "Pig — sort · group · join · project · filter").

I ran this command:
<PASTE THE EXACT COMMAND YOU TYPED>

And got this output/error:
<PASTE THE FULL OUTPUT OR ERROR HERE>

Please: (1) explain what went wrong in simple words, (2) give me the exact command(s) to fix it, one at a time, (3) tell me how to verify the fix worked. Do not suggest reinstalling anything unless nothing else can work, and do not change directory names like /bda3 or file names like WeatherDataProcessor.java — the lecturer checks those exact names.
```
