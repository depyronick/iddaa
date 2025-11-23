## Task Tracker
- Goal: build full, well-typed models for all sportsbook/statistics endpoints, then map meanings using frontend usage to return meaningful objects to the backend.
- Current focus: enumerate keys from each endpoint, lock down shapes, then clarify semantics from UI code.
- Compact note: context retained as of this entry; `/api/matches` now serves the v2 payload directly and the old v1 UI/routes are removed. Types updated; next phase: extract field meanings from frontend chunks/URLs to replace inferred comments.

### Progress
- `get_market_config`: keys confirmed from live payload. Required fields on entries (`i,n,il,mt,mmdv,mmlv,p,st,mst,mdv,mlv`) with optional `d,o,sn,so,in`. Maps present: `m`, `mg`, `msg`, `dmg`, `dmsg`, `s` (all populated). Group keys: `i,n,p,st,sg,im,iv`; subgroup keys: `i,n,p,mg,m,im,iv,il` (+ optional `h`); sport keys: `i,n,p,ic,ics,icc,sl`. Types updated in `src/types/match.ts` and wired in `src/lib/services/matches.ts` with generic `fetchJson`.
- Frontend now points to the v2 live matches UI (root route re-exports it) and `/api/matches` aliases the v2 payload; v1 UI removed.
- Helpers adjusted to use `mst`/name for 1X2 detection (experiments engine/base) instead of the old `m` guess.
- `events?st=1&type=1&version=0`: top keys `isSuccess,data,message`; `data` has `isdiff,version,events,sc,rmi`. Event keys seen: `i,bri,v,hn,an,sid,s,bp,il,m,ci,oc,d,hc,mbc,kOdd,kMbc,mpi` (and sometimes `kLive`/`hduel` per older code). Markets in this feed carry `i,t,st,v,s,mbc,sov?,o`; outcomes carry `no,n,odd,wodd`. Score map `sc` entries use keys `sid,id,t,s,ht,at,min,sec` (matches EventScore).
- `event/{id}?allMarkets=true`: query param `allMarkets=true` (no change in keys vs default); data keys match events feed plus `sc` embedded. Markets same shape as events feed (`i,t,st,v,s,mbc,sov?,o`), outcomes `no,n,odd,wodd`. `sc` object has `sid,id,t,s,ht,at,min` (ht/at with `r,c` seen).
- `competitions`: no params. Keys per entry: `i,cid,p,ic,si,n` always present; optional `sn` (missing 9/298) and `cref` (missing 3/298). Data array length 298.
- `outcome-play-percentages?sportType=1`: response shape `eventId -> marketId(mst?) -> outcomeId -> percentage(number 1-100)`. Top keys `isSuccess,data,message`; ~447 events sampled, values range 1-100. No extra fields on leaf values.
- `played-event-percentage?sportType=1`: response shape `eventId -> percentage` (number). ~378 entries; values observed range 0.01–11.05.
- `statistics/eventsummary/1/{eventId}`: top keys `isSuccess,data,message`. `data` contains: `eventInformationModel`, `recentEventModel`, `lastEventModel`, `soccerMatchEventsAllModel`, `soccerIddaaAnalysModel`, `soccerRefereeStatisticsModel`, `soccerRefereePageModel`.  
  - `eventInformationModel`: `eventDate,eventId,broadageId,homeTeam/awayTeam{id,name,mediumName,shortName,logo},score{sid,id,t,s,ht{r,c},at{r,c},min},tournamentInformation{id,name,shortName},roundInformation{id,name,shortName},statusInformation{id,name},eventPlaceInformation{temperatureC}`.  
  - `recentEventModel` / `lastEventModel`: `events` arrays (often empty in samples).  
  - `soccerMatchEventsAllModel.events`: array of incidents with keys `id,minute,teamId,type{id,name,shortName},player{id,knownName,knownNameMedium,knownNameShort,shirtNumber}` (sample had 4 entries).  
  - `soccerIddaaAnalysModel`: `generalInformations` (array with `text`), `bettingAnalysis` (empty in sample).  
  - `soccerRefereeStatisticsModel`: keys `eventId,broadageId,updateDate,referee,matchTournament,refereeTournaments` (values empty/undefined in sample).  
  - `soccerRefereePageModel`: keys `eventId,homeTeam,awayTeam,referee,refereeTournaments,refereeMatches`; sample `referee` contained `{id:0, age:0, country:{}}`.
- `statistics/headtohead/{sportType}/{eventId}/{limit}` (e.g., `/1/{id}/10`): data keys `overall,homeTeam,awayTeam` (headToHeadMatches empty in samples). `overall` array entries: `eventDate,homeTeam{id,name,shortName},awayTeam{id,name,shortName},homeTeamScore{regular,current,halfTime},awayTeamScore{regular,current,halfTime},tournamentInformation{id,name,shortName}`. `homeTeam`/`awayTeam` also at root.
- `statistics/lastmatches/{sportType}/{eventId}/{limit}` (e.g., `/1/{id}/10`): data keys `homeTeam,awayTeam,homeOverAll,awayOverAll` (lastMatches empty in sample). Entries mirror head-to-head overall rows: `eventDate,homeTeam{id,name,shortName},awayTeam{id,name,shortName},homeTeamScore{regular,current,halfTime},awayTeamScore{regular,current,halfTime},tournamentInformation{id,name,shortName}`.
- `statistics/socceriddaaanalys/{eventId}`: data keys `generalInformations,homeTeam,awayTeam,bettingAnalysis`. `generalInformations` array items `{text}`; `bettingAnalysis` array items `{marketName,outcomeNo,text}` (strings); home/away team present.
- `statistics/missingplayerandstats/{sportType}/{eventId}`: mixed responses. For event `2506392` we get data keys `eventId,eventDate,homeTeam{id,name,players},awayTeam{id,name,players}`, `missingPlayers` empty. Player objects include `id,name,age,position,numberOfMatches,lineupCount,reason,reasonDetail,goals,assists`. Earlier samples returned `{code:510,name:'EventNotFound',message:'Etkinlik bilgileri bulunamadı'}`.
- `statistics/soccerrefereepage/{eventId}/{limit}` (e.g., `/10`): data keys `eventId,homeTeam,awayTeam,referee,refereeTournaments,refereeMatches`. `referee` has `id,name,firstName,surName,age,country{name,shortName}`. `refereeMatches` items: `date,tournamentInformation{id,name,shortName},homeTeam/awayTeam{id,name,shortName,mediumName,score{regular,halfTime,current}}`. `refereeTournaments` items: `{tournament{id,name,shortName}}`.
- `statistics/standing/{sportType}/{eventId}`: data keys observed as `"0"` mapping to `{overAll:[...]}`. `overAll` rows include `scored,against,average,position,delta,played,won,draw,lost,points,team{id,name,shortName,mediumName,logo},positionStatus{id,name},groupingvalue{id,parentId},nextMatchInfo{nextMatchTeamId,nextMatchTeamName,isHome},formStandings[array]`.
- Sportradar `match_detailsextended/{betradarId}?T=...`: with provided token and iddaa headers returns data. Shape: top-level `{queryUrl, doc:[{event:'match_detailsextended', _dob, _maxage, data:{_doc:'details', _matchid, teams{home,away}, index[number|string], values{key->{name,value{home,away}}},
  types{key->label}}]}`. Value objects can carry numbers or strings (e.g., `"0/1"` or arrays). Keep token updated; prior tokens returned 403 when expired.
- Frontend chunk `_next/static/chunks/9624-30273dad2bfb85ea.js` (filters/badges):
  - Query filters: `kingBetType` maps 1/2/3 → `kMbc`/`kOdd`/`kLive` flags on events (King MBS/King Odds/King Live); `mbs` uses `event.mbc`; `hasRapidMarket` uses `event.hr`; `league`/`date`/`fav`/`percentage` filters present. Filtering marks `li` true/false and attaches competition info (`cn,cp,cid`).
  - Badge tooltip data: `kbodd` (“Kral Oran” higher odds), `kbmbs` (“Kral MBS” lower MBS), `kblive` (“Kral Canlı” iddaa.com live) with `skbet` count badge. `duel` flag triggers duello message; `hduel` likely backend flag. Editor comment icon shown separately. `bp === 1` enables all-odds widget for live events when config allows.
  - “Rapid market” refers to `hr` flag; `mbc` is minimum bet count; `kMbc` is king-bet MBS; `kOdd` king boosted odds; `kLive` king live availability.
- Frontend chunk `_next/static/chunks/pages/_app-cae1fa6b584fc72a.js`: Redux widget reducer shows socket merge logic:
  - Socket keys: `es` → event `s`, `mc` → `oc` (market count), `bp` → `bp`, `ev` → `v`, `mb` → `mbc`.
  - Market updates: merges `m` array, matching by `i` and optional `sov`/`k` composite; outcome updates map `r.c`→`cs`, `r.o`→`odd`, `r.w`→`wodd`.
  - Confirms `oc` meaning as market count from socket (`mc`).
- Frontend chunk `program/[sportName]/mac-detay/[...all]-54977ea45ded8f0c.js` (match detail page): mostly renders statistics widgets/editor comments; no new hints on event-level flags (`hc`, `mpi`, `iskbet`) beyond existing knowledge.
- New build (buildId `pnjcNg9hYlyOZPiAvxm7R`) inspected via DevTools:
  - Route chunk `program/[sportName]/mac-detay/[...all]-54977ea45ded8f0c.js` still used; shared chunks include `2942-*`, `8163-*`, `7879-*`.
  - In shared chunk `7879-f76814ee0c5ac1c9.js`: event mapping computes `iskbet` as “has any king perks” boolean `((kOdd?kMbc?kLive?count)>0)` and `skbet` as the count of king perks (`kOdd + kMbc + kLive`). Also exposes `kbodd/kbmbs/kblive` booleans and `hasduel`, `oc`, `sov`.
  - Chunks `2942-*` and `8163-*` consume `iskbet/skbet` for match cards. No sightings of `hc` or `mpi` usage in these chunks.
- Further chunk scan for unknown fields:
  - `hc`: Found only in UI conditionals gating the “İstatistikler” tab (chunks `9624-*` and mac-detay page). For non-football sports it checks `event.hc` to decide whether to show stats; implies `hc` is a “has statistics (head-to-head/coverage)” flag. Still no other semantic use.
  - `mpi`: Found in navigation URL builders (chunks `9624-*`, `2628-*`, `562-*`, `market-sorgulama` page). Used as a preferred path segment over `eid` when present in event lists; appears to be a “match path id/short path identifier” for friendly URLs. No functional logic beyond URL construction.

### Endpoints to type next (seen in `matches.ts`)
- Sportsbook: `events` (captured), `event/{id}?allMarkets=true`, `competitions` (captured), `outcome-play-percentages` (captured), `played-event-percentage` (captured), `get_market_config` (done).
- Statistics: `eventsummary`, `headtohead`, `lastmatches`, `socceriddaaanalys`, `missingplayerandstats`, `soccerrefereepage`, `standing`.
- Sportradar: `common/.../gismo/match_detailsextended/{betradarId}`.

For each endpoint: capture query params (ids, sportType, pagination, flags), response keys, field meanings, and any required headers. Document everything in this file and mirror shapes in `src/types/match.ts`.

### Open items / next steps
- Pull fresh samples from each endpoint above, list all keys, and tighten TypeScript interfaces in `src/types/match.ts`.
- For each field, cross-check frontend usage to infer real meaning; annotate and replace placeholder comments/unknowns (upcoming: scrape/inspect frontend chunk URLs for semantics).
- After shapes are finalized, return more meaningful mapped objects from the backend (reduce `unknown`/`any` in consumers). Consumer paths now use `/api/matches` (v2 payload) only.
