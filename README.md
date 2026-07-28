# BDAL Lab 4 Trainer

**Learn the lab by typing it.** A single-file, type-to-learn trainer for the newer BDAL
(Big Data Analytics Lab) experiments: install preflight, cluster startup, HDFS commands
(Lab 2), the **Weather-CSV MapReduce job (Lab 4)** and **Apache Pig** — all inside a
**simulated terminal** that behaves like the real lab.

**Live:** https://shinzuu.github.io/bdal-lab-4-trainer/
Earlier labs (incl. matrix multiplication) live in the companion app:
https://shinzuu.github.io/bdal-playground/

## How it works

1. **Pick your OS** — Linux/WSL2, macOS, or native Windows. Start commands, local paths,
   Java/Hadoop versions and daemon counts adapt to match your machine.
2. **Guided modules** — every step is: prerequisites/theory (1–2 lines) → a task → *you
   type the command* into the simulated terminal → the expected outcome. First encounters
   break the command down word by word; wrong commands produce the real error messages
   (yes, including `Connection refused` when you forgot to start the cluster, and
   `FileAlreadyExistsException` when you forgot to delete the output dir).
3. **Recap rounds** — same commands, new paths, no theory.
4. **Exam mode** — preflight + Lab 2 + Weather CSV + Pig start to finish from a fresh
   cluster, scored, hints locked until two misses.
5. **Sandbox** — a free-play terminal with the same simulated cluster.

Every core command gets typed at least three times (guided → recap → exam). That is the
whole point: the commands should be in your fingers before the lab, not on a cheat sheet.

## Modules

| # | Module | Covers |
|---|--------|--------|
| 1 | Preflight — prove the install | `java -version`, `hadoop version`, `echo $HADOOP_HOME`, `pig -version` |
| 2 | Boot the cluster | `hadoop-start` / `start-all.cmd`, `jps`, web UIs (9870 / 8088) |
| 3 | HDFS commands — Lab 2 | `-mkdir`, `-copyFromLocal`/`-put`, `-copyToLocal`/`-get`, `-cat`, `-rm`, `-rmdir`, `-rm -r` |
| 4 | Weather CSV — Lab 4 | inspect the CSV → load to `/bda3` → `javac` against the Hadoop classpath → `jar` → `hadoop jar … WeatherDataProcessor` → read all 31 classified days |
| 5 | Pig | `pig -version` (the install proof), `pig -x local script.pig` — FILTER · PROJECT · ORDER · GROUP · JOIN on two CSVs |

The weather module teaches the classification traps that vivas love: priority order
(snow → storm → rain → temp), why "Drizzle" is **not** rainy, why "Thunderstorm" **is**
stormy, and why this dataset has zero Cold Days. It also reminds you that in the real lab
you must customise the six `weatherMessage.set()` strings to your own words.

## Development

```
src/engine.js    pure simulator: HDFS tree, cluster lifecycle, weather job, pig, per-OS
src/lessons.js   modules / recaps / exam — steps validated by effect, not string-match
src/app.js       UI layer
node --test test/*.mjs   # 36 tests: every canonical answer must pass its own check on all 3 OSes
node build.mjs           # inlines everything into a single index.html
index.html?test=1        # 177 in-browser smoke checks
```

No dependencies, no build tools beyond node itself.

## Credits

- Weather program (`WeatherDataProcessor.java`), `Weather.csv` and the Pig lab come from
  <https://github.com/hossain-tamim/big_data_analytics_lab> — credit to the original author.
- Companion repos: [bdal-playground](https://github.com/Shinzuu/bdal-playground) (earlier labs),
  [hadoop-bdal-lab-kit](https://github.com/Shinzuu/hadoop-bdal-lab-kit) (real-machine lab kit).
