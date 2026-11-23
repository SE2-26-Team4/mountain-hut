# RETROSPECTIVE (Team 4)

The retrospective includes the following
sections:

- [process measures](#process-measures)
- [quality measures](#quality-measures)
- [general assessment](#assessment)

## PROCESS MEASURES

### Macro statistics

- Number of stories committed vs done: 6 vs 6
- Total points committed vs done: 32 vs 32
- Nr of hours planned vs spent (as a team): 81h 30m vs 78h 35m

**Definition of Done**

A story is done ONLY if it fits the Definition of Done:

- Unit Tests passing
- Integration tests passing
- End-to-End tests performed and passing
- Code review completed by another team member
- Code committed to the version control system (Git) and pushed to the shared repository (GitHub)
- The relevant documentation is up to date
- The story meets its acceptance criteria

### Detailed statistics

| Story                              | # Tasks | Points | Hours est. | Hours actual |
| ---------------------------------- | ------: | -----: | ---------: | -----------: |
| _#0_                               |      13 |      - |    36h 00m |      34h 25m |
| MH-04 — Check availability         |       3 |      3 |     2h 15m |       2h 40m |
| MH-05 — Provide party requirements |       3 |      5 |     1h 45m |       1h 55m |
| MH-06 — Change a booking           |       4 |      8 |     6h 30m |       5h 40m |
| MH-07 — Reserve for an hiker       |      10 |      5 |    16h 30m |      16h 55m |
| MH-08 — Cancel a booking           |       4 |      3 |         6h |           5h |
| MH-09 — Repeat a weekly schedule   |       8 |      8 |    12h 30m |      12h 00m |

> Technical tasks correspond to story `#0`, and story points are not applicable in this case

- Hours per task per person (average, standard deviation)

  > $n = 45$ = total number of tasks<br>
  > $h_i$ = hours per person for task $i$<br>
  > $\mu$ = average of the corresponding $h_i$ values<br>
  > $s$ = sample standard deviation of those values
  - **Hours estimated (average)**

    $\mu = \frac{\sum_{i=1}^{n} h_i}{n} = \frac{81.50 - 18.75 + (18.75 / 5)}{45}\text{h} = \frac{66.50}{45}\text{h} \approx 1.48\text{h} \approx 1\text{h}\ 29\text{m}$

  - **Hours estimated (standard deviation)**

    $s = \sqrt{\frac{\sum_{i=1}^{n}(h_i-\mu)^2}{n-1}} = \sqrt{\frac{\sum_{i=1}^{45}\left(h_i-\frac{66.50}{45}\right)^2}{44}} \approx 0.91\text{h} \approx 55\text{m}$

    _The estimates varied because some tasks, such as small code reviews, were planned to take only 15m, while larger development tasks were planned to take 2h 30m._

  - **Hours spent (average)**

    $\mu = \frac{\sum_{i=1}^{n} h_i}{n} \approx \frac{78.58 - 18.75 + (18.75 / 5)}{45}\text{h} = \frac{63.58}{45}\text{h} \approx 1.41\text{h} \approx 1\text{h}\ 25\text{m}$

  - **Hours spent (standard deviation)**

    $s = \sqrt{\frac{\sum_{i=1}^{n}(h_i-\mu)^2}{n-1}} \approx \sqrt{\frac{\sum_{i=1}^{45}\left(h_i-\frac{63.58}{45}\right)^2}{44}} \approx 0.89\text{h} \approx 53\text{m}$

    _Some reviews took only 15m, while some development and bug-fixing tasks took 2h 30m. One bug-fixing task took 3h._

- Total task estimation error ratio:

  $r = \frac{\text{Total hours estimated}}{\text{Total hours spent}} - 1 = \frac{81 + 30/60}{78 + 35/60} - 1 \approx +0.0371$

  _The ratio is positive because we planned 81h 30m of work and spent 78h 35m. We finished 2h 55m under our estimate_

## QUALITY MEASURES

- Unit Testing:
  - Total hours estimated: Not tracked separately. Time spent updating tests was included in the corresponding task.
  - Total hours spent: Not tracked separately. Time spent updating tests was included in the corresponding task.
  - Nr of automated unit test cases: 254
  - Coverage: unit tests alone cover 38.01% of statements, 41.47% of branches, 37.54% of functions, and 38.33% of lines. Unit and integration tests combined cover 100% of statements, branches, functions, and lines.
- Integration testing:
  - Total hours estimated: Not tracked separately. Time spent updating tests was included in the corresponding task.
  - Total hours spent: Not tracked separately. Time spent updating tests was included in the corresponding task.
- E2E testing:
  - Total hours estimated: 5h 45m
  - Total hours spent: 6h 25m
- Code review:
  - Total hours estimated: 12h 30m
  - Total hours spent: 11h 55m

## ASSESSMENT

- What caused your errors in estimation (if any)?
  - **Coverage and final reviews.** We set aside 2h 30m for each final check to allow for unexpected issues. This sprint, we kept the tests up to date as we developed each task, which helped us check our changes as we went. No unexpected issues came up during the final coverage check, so it took only 30m.
  - **Bug fixes.** We set aside 2h 30m for each bug-fixing task because we prefer to leave enough time for unexpected problems. We also had different ideas about when to stop testing. Some of us preferred to spend more time looking for bugs, while others felt a shorter check was enough once they saw that the feature worked as expected. Overall, we spent 9h on bug fixes, 1h less than planned.
  - **E2E testing.** We spent 6h 25m on manual E2E tests, 40m more than planned. The team members who did the tests took extra time to check each feature carefully and report possible bugs. This helped the team fix small issues.
  - **Small differences.** Some tasks took a few minutes more or less than planned. This is normal because we estimate the time before we start, and we can’t predict exactly how long each task will take.
  - **Changes to the initial estimate.** We initially planned 80h for the sprint. Our original idea was to include the work on the Docker image for Release 1 in the _Additional Development Support_ task. During the sprint, supporting new features took longer than expected, so we added a separate task to track the release work, bringing our estimate from 80h to 81h. What brought our total estimate to 81h 30m was that a cross-cutting task had been moved to _Done_ while a few adjustments were still needed. To avoid moving the original task back to _In Progress_, the team member responsible created a new task to log the time spent on those adjustments. The original estimate already covered this work, so the new task added another 30m to our total estimate.
  - **Total hours spent.** We spent 78h 35m on the sprint, 1h 25m less than the 80h we initially planned. One reason was that team members had different views on how much checking each task needed.

- What lessons did you learn (both positive and negative) in this sprint?
  - **Positive:**
    - Writing unit and integration tests during development helped us find and fix problems as we went. It also helped us check that each task met the user story requirements. This left us with less testing to do at the end of the sprint.
    - Working on the main features of each user story during the first few days worked well: once the main development tasks for all the stories were complete, we did the manual E2E tests and fixed the bugs we found. We then worked on the documentation and did the final reviews of the frontend, backend, and tests. This helped us feel confident that we could finish the work on time.
  - **Negative:**
    - Our sprint calendar showed who would work on each task and on which day, but we sometimes found it hard to follow when plans changed. We learned that meeting the planned date matters most when another team member needs that work to start their own task. Next time, we’ll do our best to follow the calendar, especially when another team member is waiting for us to finish a task.

- Which improvement goals set in the previous retrospective were you able to achieve?
  1. **Plan the Docker release (Release 1) as explicit tasks — achieved.** At first, we understood this goal as setting aside time for Release 1 in the sprint, so we preferred to include it in the _Additional Development Support task_. During the sprint, supporting new features took longer than expected, so we decided to give the release its own task. This made it easier to track the Docker deployment, the release guide, and the demo setup together and helped us follow the original goal more closely.
  2. **Agree on the frontend structure before coding — achieved.** We shared a mockup with the whole team and discussed it together. We started implementing the frontend once everyone agreed on the design.

- Which ones you were not able to achieve? Why?

  We achieved both goals. The one change was how we planned the Docker release. We included it in _Additional Development Support_ at first. When feature support took longer than expected, we created a separate task to track the release work.

- Improvement goals for the next sprint and how to achieve them (technical tasks, team coordination, etc.)
  1. **Follow the sprint calendar more closely.** During Sprint Planning, mark the tasks that another team member needs before they can start their own work. At each Daily Scrum, check whether those tasks are on track. If a date needs to change, tell the person waiting and update the calendar together.

  2. **Agree on important changes before starting work.** When we need to make an important change, we’ll discuss it as a team and agree on how to proceed before making it.

- One thing you are proud of as a Team

  We are proud that we completed all six user stories we committed to at the start of the sprint. We chose to include six because the first few needed only small changes to the code we had written in Sprint 1. Completing all six still took a lot of effort, and we met the goal we had set together.
