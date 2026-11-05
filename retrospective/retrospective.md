TEMPLATE FOR RETROSPECTIVE (Team 04)
=====================================

The retrospective should include _at least_ the following
sections:

- [process measures](#process-measures)
- [quality measures](#quality-measures)
- [general assessment](#assessment)

## PROCESS MEASURES 

### Macro statistics

- Number of stories committed vs done :
- Total points committed vs done :
- Nr of hours planned vs spent (as a team) :

**Remember**  a story is done ONLY if it fits the Definition of Done:
 
- Unit Tests passing
- Code review completed
- Code present on VCS
- End-to-End tests performed

> Please refine your DoD 

### Detailed statistics

| Story  | # Tasks | Points | Hours est. | Hours actual |
|--------|---------|--------|------------|--------------|
| _#0_   |         |    -   |            |              |
| n      |         |        |            |              |
   

> place technical tasks corresponding to story `#0` and leave out story points (not applicable in this case)

- Hours per task  <span style="color:red">per person</span>  (average, standard deviation)
- Total task estimation error ratio: sum of total hours estimation / sum of total hours spent -1

  
## QUALITY MEASURES 

- Unit Testing:
  - Total hours estimated
  - Total hours spent
  - Nr of automated unit test cases 
  - Coverage (if available)
- Integration testing:
  - Total hours estimated
  - Total hours spent
- E2E testing:
  - Total hours estimated
  - Total hours spent
- Code review: 
  - Total hours estimated 
  - Total hours spent

  


## ASSESSMENT

__- What caused your errors in estimation (if any)?__

_waiting for report time stats_

__- What lessons did you learn (both positive and negative) in this sprint?__

**Positive: no tasks on weekends.** Planning with no tasks on weekends works better. It adds workload from Monday to Friday, but it leaves us two days to focus on other work or to recover late tasks if needed. The weekend of October 31 – November 1 was free and acted as a buffer. Several tasks that slipped from their planned day were completed and merged that weekend, for example *Booking availability and table allocation*, *Slot-table assignment and capacity aggregation* and *Meal-slot and capacity API*.

**Negative: frontend ownership was too fragmented.** The frontend must be written and reviewed by the person who will present the demo, plus at most one other member. The presenter must understand better than anyone else how the final actor will use the app, because the demo shows the flows from the actor's point of view.


__- Which improvement goals set in the previous retrospective were you able to achieve or not?__

> Agree on a shared way of working and balance the workload: Some members checked details and links with related tasks, while others focused mainly on their assigned tasks. At the start of the next sprint, agree on how to handle these cross-task checks. Check in regularly to compare workloads, discuss blockers, and redistribute tasks early when needed.

In this sprint we assigned each task to only one person. This reduced blockers and kept the workload balanced among members.

In the current sprint calendar every task has exactly one owner, and every implementation task has a matching code review task assigned to a different member. Only the team activities (Sprint Planning, Daily Scrums, Retrospective) are shared. Each task description lists the files to create or modify, so the boundaries between related tasks were clear from the start, and nobody had to guess which checks belonged to their own task and which belonged to someone else's.

We held a Daily Scrum every other working day (October 27 and 29, November 2, 4 and 6) to check progress and discuss blockers.

>  Plan a more realistic sprint: Use actual task times from this sprint as a reference, include time for implementation, testing, integration, and review, and commit to a smaller amount of work that fits the team’s capacity. Clarify whether real-world requirements, such as printing or otherwise issuing a physical ticket, are in scope.

We did apply part of this goal. Each story was broken into implementation, testing, bug-fixing, end-to-end testing, test coverage review and code review tasks, and we sized the sprint to the team's capacity (16h per member, 80h in total).

However, the plan left very little time for unplanned work: only *Additional development support* (1h30) and its review (0h30), that is 2h out of 80h. During the sprint we needed several activities that no task covered, for example:

- Docker configuration with persistent SQLite storage, plus environment fallbacks for standalone deployment;
- upgrading Express and its types to version 5, and allowing the sqlite3 install script for npm 12;
- resolving merge conflicts and restoring test discovery after merges.

Our estimates did not include this work, so the plan was less realistic than we intended.

__- Improvement goals for the next sprint and how to achieve them (technical tasks, team coordination, etc.)__

1. **Plan the Docker release (Release 1) as explicit tasks.** Sprint 2 ends on November 20 with Demo 2, Retrospective 2 and Release 1. The release needs a complete Docker deployment that third parties can run, startup and usage instructions, and the Docker image link on the shared sheet. A `Dockerfile` and a `docker-compose.yml` already exist from Sprint 1, but we built them outside the plan.
   <!-- *How:* during Sprint Planning, add dedicated tasks for completing the Docker configuration, building and publishing the image, writing the deployment instructions in the README, and checking that the deployment works by following only those instructions. Give each task an estimate, an owner and a reviewer. Spread these tasks across the sprint instead of leaving them for the last days. -->

2. **Agree on the frontend structure before coding.** Sprint 1 task descriptions already named the frontend files, but the structure changed during development and the tasks no longer matched the work.
   <!-- *How:* during Sprint Planning, define the pages, components, hooks and API modules each story needs, and write them into the task descriptions. Assign the frontend tasks to the demo presenter plus at most one other member (see lessons learned). Reuse shared components such as `ProfileMenu`, and define global style variables only in `index.css`. If someone needs to change the agreed structure, discuss it at the Daily Scrum before implementing it. -->


__One thing we are proud of as a team__

We delivered all committed stories with all required features: MH-01 *Book a table*, MH-02 *Define slot capacity* and MH-03 *Receive confirmation*, 21 SP in total. This met the Sprint Goal, registered hikers can book available seats for a meal and receive an email confirmation, and hut staff can configure meal slots, tables and seating capacity. We also performed the end-to-end flows correctly.

This gives Sprint 2 a working base to build on. For example, MH-04 *Check availability* is planned to reuse the capacity and table-allocation logic we built in this sprint.