# Incident Management Test Cases

## 1. Scope

This test suite covers the Incident Management workspace, including:

- Incident registration and required-field validation
- Customer, contract, asset, product, component, and serial-number relationships
- Assignment groups, assignees, visibility, and edit permissions
- Incident list search, scopes, filters, sorting, grouping, pagination, and export
- Workflow stages and process configuration
- Work notes, mentions, notifications, and audit history
- Attachments and camera/image capture
- Repair execution and resolution data
- Post-repair quality review and customer acceptance
- Material replacement, Advisory approval, MRLS/TASL routing, and follow-up incidents
- Persistence, refresh, concurrent updates, and failure handling

## 2. Test Data and Roles

### Users

| User | Role / membership | Purpose |
|---|---|---|
| Administrator | Administrator | Full incident visibility and edit access |
| CSM Manager | Manager of Customer Support Management Group | Full CSM group access |
| CSM Engineer | Active member of Customer Support Management Group | Group-level access and work notes |
| Advisory Member | Active member of Advisory Group | Approval decisions |
| Unrelated User | Active user outside incident group | Negative visibility and edit tests |
| Inactive User | Inactive account | Assignment and mention exclusion |

### Required reference records

Prepare at least:

- Two customers with contacts
- One customer with an additional customer contact option
- One active contract and one expired contract
- One product category with a serial number assigned to the selected customer and contract
- One serial number with multiple sub-systems/components
- One serial number not assigned to the selected customer/contract
- Active and inactive assignment groups
- Active and inactive group members
- Process configurations for Incident Registration, Repair at Factory, Repair at Site - TASL, Repair at Site - Vendor, and Pre Delivery Flight
- At least one MRLS-compatible spare for a replacement test
- An email rule/template configuration for incident creation, assignment, work notes, approvals, and dissatisfaction return

### General test conventions

- Execute each case once with a clean browser session where relevant.
- Record the incident number, user, timestamp, and database/API response for every persistence test.
- For notification cases, verify both in-app notification records and email-log records where email delivery is configured.
- Unless a case says otherwise, use valid values for all fields not under test.

## 3. Registration and Required Fields

### IM-REG-001 Create a valid incident

**Type:** Positive

**Preconditions:** User belongs to a permitted incident-creation group; valid customer, contract, serial number, component, and assignee exist.

**Steps:**

1. Open Incidents.
2. Select New Incident.
3. Select a customer.
4. Select a requestor and contract.
5. Select product category, eligible serial number, sub-system, component, and material serial number.
6. Select occurrence phase, priority, and assignee.
7. Enter short and detailed descriptions.
8. Add a valid attachment.
9. Submit the incident.

**Expected:**

- An incident number is generated using the configured customer/contract sequence.
- The incident is saved once, with no duplicate record.
- Status is the configured Registered stage.
- Assignment group is Customer Support Management Group.
- Selected customer, contract, asset, component, priority, descriptions, and attachment are retained.
- The list shows the new incident.
- Assignment and registration notifications are created according to active rules.
- An audit entry is available after subsequent edits.

### IM-REG-002 Open a new incident when creation is not permitted

**Type:** Negative

**Preconditions:** User is not an Administrator and is not in a permitted creation group.

**Steps:**

1. Open Incidents as the restricted user.
2. Attempt to open New Incident directly, using a bookmarked route if necessary.
3. Attempt to submit a complete incident if the form is reachable.

**Expected:**

- New Incident is not offered in the normal UI.
- Direct submission is rejected with a permission message.
- No incident record, notification, or audit entry is created.

### IM-REG-003 Required-field validation

**Type:** Negative

**Steps:**

1. Open New Incident.
2. Leave all required fields empty.
3. Select Submit incident.

**Expected:**

- Submission is blocked.
- Required errors appear for customer, requestor, contract, product category, serial number, component, material serial number, occurrence phase, priority, assigned group, assignee, short description, and detailed description.
- No API write occurs.
- Entered non-required values remain intact.

### IM-REG-004 Validate each required field independently

**Type:** Negative

**Steps:**

1. Complete every required field except one.
2. Submit the form.
3. Repeat for every required field.

**Expected:**

- Only the omitted field is reported as required.
- The incident is not written until the field is supplied.

### IM-REG-005 Customer controls requestor and contract choices

**Type:** Positive / Negative

**Steps:**

1. Select Customer A.
2. Confirm requestor and contract choices belong to Customer A.
3. Change to Customer B.
4. Inspect requestor, contact, contract, system, warranty, category, serial number, and component fields.
5. Attempt to submit using a Customer A contract or asset.

**Expected:**

- Customer A's primary contact is selected initially.
- Customer A's contracts are displayed.
- Changing customer clears dependent fields and reloads Customer B data.
- A contract or asset belonging to another customer cannot be selected as a valid relationship.
- Submission with stale dependent data is blocked or normalized to the new customer.

### IM-REG-006 Customer other contact

**Type:** Positive

**Steps:**

1. Select a customer.
2. Select Customer other.
3. Enter a new requestor name and valid phone number.
4. Submit the incident.
5. Inspect the customer contacts.

**Expected:**

- Requestor and contact inputs become editable.
- The new contact is added to the customer record.
- The incident stores the supplied requestor and contact.

### IM-REG-007 Invalid customer-other phone number

**Type:** Negative

**Steps:**

1. Enable Customer other.
2. Enter fewer than 10 digits, alphabetic characters, or an invalid phone format.
3. Attempt to submit.

**Expected:**

- Invalid characters are rejected or normalized.
- The incident cannot be submitted until the phone value meets the configured format.
- No partial contact or incident write occurs.

### IM-REG-008 Contract-dependent product category

**Type:** Positive / Negative

**Steps:**

1. Select a customer without selecting a contract.
2. Attempt to select a product category.
3. Select a contract.
4. Select a category and inspect the eligible serial-number results.

**Expected:**

- Category selection is disabled until a contract is selected.
- Serial numbers are filtered by customer, contract, and category.
- An asset from another contract is not offered as an eligible result.

### IM-REG-009 Serial number selection populates product information

**Type:** Positive

**Steps:**

1. Select a valid customer, contract, category, and serial number.
2. Inspect system, sub-system, and last-serviced fields.
3. Select a sub-system and component.

**Expected:**

- System and available sub-systems are populated from Product Master/asset data.
- Component options correspond to the selected sub-system.
- Material serial number is populated from the selected component.
- Changing the serial number clears incompatible sub-system, component, and material serial values.

### IM-REG-010 Reject an unassigned serial number

**Type:** Negative

**Steps:**

1. Search for a serial number that exists but is not assigned to the selected customer, contract, or category.
2. Attempt to select and submit it.

**Expected:**

- The serial is not shown as an eligible option, or submission is rejected.
- No incident is saved with an invalid asset relationship.

### IM-REG-011 Occurrence phase and priority behavior

**Type:** Positive / Negative

**Steps:**

1. Select In Flight.
2. Inspect priority.
3. Change to Ground Operations.
4. Try to submit without a priority.

**Expected:**

- In Flight defaults priority to High when no priority was previously selected.
- Ground Operations does not silently remove a deliberately selected priority.
- Submission without a valid priority is blocked.

### IM-REG-012 Duplicate submit protection

**Type:** Negative / Reliability

**Steps:**

1. Complete a valid incident.
2. Double-click Submit incident or submit repeatedly while the first request is pending.
3. Refresh the list.

**Expected:**

- Only one incident is created.
- Only one registration notification set is generated.
- The UI does not create duplicate records from repeated clicks.

### IM-REG-013 API/database write failure during creation

**Type:** Negative

**Preconditions:** Simulate an API failure or temporarily unavailable database.

**Steps:**

1. Complete a valid incident.
2. Submit while the incident write fails.

**Expected:**

- A clear save error is displayed.
- The user remains on the form with entered values preserved.
- The incident does not appear in the list as saved.
- No success notification is emitted.

## 4. Incident List and Data Operations

### IM-LIST-001 Display incident list

**Type:** Positive

**Steps:**

1. Open Incidents as an Administrator.
2. Inspect columns, values, status, assignment group, priority, and dates.

**Expected:**

- Incidents are displayed with number, opened date, short description, assignment group, priority, status, and action controls.
- Dates and status values are readable and consistent.

### IM-LIST-002 Search by incident number

**Type:** Positive

**Steps:**

1. Enter a complete incident number.
2. Enter a partial incident number.
3. Clear the search.

**Expected:**

- Complete and partial matches are returned.
- Non-matching incidents are hidden.
- Clearing search restores the list.
- Pagination resets appropriately.

### IM-LIST-003 Search by description and status

**Type:** Positive

**Steps:**

1. Search using a unique short-description term.
2. Search using a status value.
3. Search using mixed case.

**Expected:**

- Matching title/status records are returned case-insensitively.
- Search does not match unrelated fields unless specified by the UI contract.

### IM-LIST-004 Scope filters

**Type:** Positive / Security

**Steps:**

1. Select All.
2. Select Assigned to me.
3. Select Assigned to my group.
4. Select Open.

**Expected:**

- All shows all incidents permitted for the user.
- Assigned to me shows incidents assigned to the current user.
- Assigned to my group shows incidents assigned to one of the user's groups.
- Open excludes Closed incidents.
- Scope changes reset pagination and counts.

### IM-LIST-005 Unauthorized incident visibility

**Type:** Negative / Security

**Steps:**

1. Log in as Unrelated User.
2. Compare the list with Administrator visibility.
3. Attempt to open an incident outside the user's assignment scope through a direct incident link.

**Expected:**

- The unrelated incident is not shown in restricted scopes.
- Direct access is view-only or denied according to role/group rules.
- The user cannot edit fields, transition status, assign, approve, or export restricted data.

### IM-LIST-006 Status and priority filters

**Type:** Positive

**Steps:**

1. Filter by each available status.
2. Filter by Critical, High, Medium, and Low.
3. Combine status and priority filters.

**Expected:**

- Results contain only records matching all selected filters.
- Empty results show a clear empty state.
- Counts and pagination reflect the filtered set.

### IM-LIST-007 Sorting

**Type:** Positive

**Steps:**

1. Sort by incident number ascending and descending.
2. Sort by opened date ascending and descending.
3. Change filters and repeat.

**Expected:**

- Sorting order is correct and stable.
- Date sorting uses dates, not display-string order.
- Sorting is preserved while viewing the current result set.

### IM-LIST-008 Grouping

**Type:** Positive

**Steps:**

1. Group by status.
2. Group by priority.
3. Group by assignment group.
4. Clear grouping.

**Expected:**

- Group headers are shown in sorted order.
- Each group count is correct.
- Incidents appear under the correct group.
- Clearing grouping returns a normal table.

### IM-LIST-009 Pagination boundaries

**Type:** Positive / Negative

**Steps:**

1. Use a data set larger than one page.
2. Select Next until the last page.
3. Attempt Next on the last page.
4. Select Prev until the first page.
5. Attempt Prev on the first page.

**Expected:**

- Page counts and ranges are correct.
- Next is disabled on the last page.
- Prev is disabled on the first page.
- Filters and searches reset or preserve page state without showing an empty invalid page.

### IM-LIST-010 CSV extraction

**Type:** Positive / Negative

**Steps:**

1. Apply a search/filter.
2. Select Extract data.
3. Open the CSV.
4. Repeat with no results and with commas, quotes, and line breaks in descriptions.

**Expected:**

- Export contains the currently filtered incidents only.
- Headers and values are correct.
- Quotes, commas, and line breaks are escaped safely.
- Export is disabled or produces a clear empty result when no incidents match.
- Restricted users cannot export incidents outside their permitted scope.

## 5. Incident Detail, Editing, and Assignment

### IM-EDIT-001 Open incident detail

**Type:** Positive

**Steps:**

1. Select an incident number or View action.
2. Inspect Details, Notes, workflow, assignment, attachments, and audit information.

**Expected:**

- Stored values populate the correct fields.
- The current workflow stage is highlighted.
- The correct edit/read-only state is shown for the current user.

### IM-EDIT-002 Edit permitted incident fields

**Type:** Positive

**Steps:**

1. Open an incident assigned to the current user or group.
2. Change allowed fields such as priority, assignment, description, warranty, or notes.
3. Save.
4. Refresh and reopen.

**Expected:**

- Changes persist.
- The list reflects updated status/assignment values.
- The audit journal records field, previous value, next value, user, group, and timestamp.

### IM-EDIT-003 Block edits on a view-only incident

**Type:** Negative / Security

**Steps:**

1. Open an incident outside the user's assignment scope.
2. Attempt to edit fields and save.
3. Attempt to move workflow stage.

**Expected:**

- Editable controls are disabled or save is rejected.
- A clear view-only message appears.
- No incident payload or audit record changes.

### IM-EDIT-004 Assignment group change

**Type:** Positive

**Steps:**

1. Open an editable incident.
2. Select another active assignment group.
3. Confirm the assignee list changes.
4. Select an active group member.
5. Save.

**Expected:**

- Assignee is cleared when the group changes.
- Only active members of the selected group are available.
- Assignment group and assignee persist together.
- Assignment notification and email are generated once.

### IM-EDIT-005 Invalid assignee for selected group

**Type:** Negative

**Steps:**

1. Select Group A.
2. Attempt to retain or submit an assignee from Group B.
3. Save.

**Expected:**

- Save is rejected with an assignment validation message.
- The incident remains unchanged.

### IM-EDIT-006 Inactive assignee

**Type:** Negative

**Steps:**

1. Deactivate a group member.
2. Open an incident for that group.
3. Inspect assignee choices and attempt to save the inactive user as assignee.

**Expected:**

- Inactive users are not offered for new assignment.
- Existing historical assignment remains visible if required for audit.
- New assignment to an inactive user is rejected.

### IM-EDIT-007 Work note save by group member

**Type:** Positive

**Steps:**

1. Open an incident where the user has group access but not full edit access.
2. Enter a work note.
3. Save.

**Expected:**

- The work note is saved as an audit entry.
- Other incident fields do not change.
- Mention and work-note notifications are created as configured.
- The note input clears after successful save.

### IM-EDIT-008 Work note required for workflow movement

**Type:** Negative

**Steps:**

1. Open an editable incident in a repair execution stage.
2. Change to the next status without entering work notes.
3. Attempt to save/transition.

**Expected:**

- Transition is blocked.
- User is directed to the Notes tab/field.
- No status or assignment change is persisted.

### IM-EDIT-009 Mention active user and group

**Type:** Positive

**Steps:**

1. Enter `@` in Work notes.
2. Search for an active user and select the suggestion.
3. Add a second mention for an active assignment group.
4. Save.

**Expected:**

- Suggestions show matching active users/groups.
- Mention markup is inserted correctly.
- Mention recipients receive in-app/email notifications according to rules.
- The author does not receive a duplicate self-notification.

### IM-EDIT-010 Mention inactive or unknown target

**Type:** Negative

**Steps:**

1. Type a mention for an inactive user or nonexistent group.
2. Save the work note.

**Expected:**

- Inactive users are not suggested.
- Unknown text does not create a recipient notification.
- The work note itself remains savable if otherwise valid.

## 6. Workflow and Process Stages

### IM-WF-001 Incident Registration progression

**Type:** Positive

**Steps:**

1. Create an incident at Registered.
2. Open it as an authorized user.
3. Move it to Advisory Group Review with a work note.
4. Save and reopen.

**Expected:**

- The configured next stage is used.
- Status, stage, assignment group, and assignee update according to process configuration.
- Work note and audit entry are saved.
- Advisory notification is generated when configured.

### IM-WF-002 Prevent invalid stage skipping

**Type:** Negative

**Steps:**

1. Open an incident at an early stage.
2. Attempt to select or save a later stage that is not the configured next stage.

**Expected:**

- Invalid stage movement is unavailable or rejected.
- The incident remains at its original stage.

### IM-WF-003 Process configuration changes next routing

**Type:** Positive

**Steps:**

1. Change the assignment group/status mapping for a process stage.
2. Open an incident at the preceding stage.
3. Move it forward.

**Expected:**

- The updated process configuration determines the next status and assignment.
- Existing incident data is not overwritten beyond the transition fields.

### IM-WF-004 Missing stage assignment configuration

**Type:** Negative

**Steps:**

1. Remove the required assignment group from the Registered stage configuration.
2. Attempt to create an incident.

**Expected:**

- Creation is blocked with a configuration error.
- No incomplete incident or notification is created.

### IM-WF-005 Repair execution selection

**Type:** Positive

**Steps:**

1. Open an incident detail.
2. Select Repair at Factory, Repair at Site - TASL, or Repair at Site - Vendor.
3. Inspect stages, current status, and assignment behavior.
4. Save the selected path.

**Expected:**

- The execution-specific stage list appears.
- Initial status is the first configured stage.
- Relevant fields become editable/read-only according to the execution path.
- Assignment is routed according to process configuration.

### IM-WF-006 Repair execution transition without required work note

**Type:** Negative

**Steps:**

1. Select a repair execution and change status.
2. Leave Work notes blank.
3. Save.

**Expected:**

- Save is rejected.
- No status, execution, assignment, or audit change is persisted.

### IM-WF-007 Repair completion requires resolution details

**Type:** Negative

**Steps:**

1. Open a repair incident.
2. Mark Repair completed.
3. Leave resolution notes empty.
4. Save.

**Expected:**

- Save is blocked until resolution details are supplied.
- Repair completion is not recorded.

### IM-WF-008 Close incident after completed repair

**Type:** Positive

**Steps:**

1. Complete all repair actions.
2. Enter resolution details.
3. Satisfy post-repair checks where applicable.
4. Move the incident to Closed.
5. Reopen it.

**Expected:**

- Closed status persists.
- Repair lifecycle closure is triggered once when applicable.
- Closure audit records the resolution and final status.
- Closed incident is excluded from Open scope.

## 7. Repair Execution, Approval, and Replacement

### IM-REP-001 Mark repair complete with valid resolution

**Type:** Positive

**Steps:**

1. Open an editable repair incident.
2. Enter work completed and resolution details.
3. Mark repair completed.
4. Save.

**Expected:**

- Repair completion persists.
- Resolution details persist.
- The next configured stage becomes available.
- Audit history records the completion transition.

### IM-REP-002 Enable part replacement

**Type:** Positive

**Steps:**

1. Open a repair-at-site incident with available components.
2. Select Part needs replacement.
3. Add a replacement component.
4. Select the component and inspect part number/current serial.

**Expected:**

- Replacement panel appears.
- Component, part number, and current serial are populated.
- Replacement source options become available.

### IM-REP-003 Replacement request requires source

**Type:** Negative

**Steps:**

1. Add a replacement part.
2. Leave replacement source blank.
3. Attempt to send for Advisory approval.

**Expected:**

- Submission is disabled or rejected.
- No approval record is created.

### IM-REP-004 TASL replacement requires reason

**Type:** Negative

**Steps:**

1. Select Request from TASL.
2. Leave the request reason blank.
3. Attempt to send for approval.

**Expected:**

- Submission is blocked.
- A reason-required message is displayed.
- No pending approval is created.

### IM-REP-005 Submit replacement approval

**Type:** Positive

**Steps:**

1. Select a source.
2. Add one or more valid replacement components.
3. Enter the replacement reason.
4. Send for Advisory approval.

**Expected:**

- Group approval is created with Pending status.
- Approval type, group, requester, parts, source, customer, contract, and reason are stored.
- Advisory members receive notifications.
- Replacement controls are locked while Pending.
- An audit/work-note entry is recorded.

### IM-REP-006 Advisory member approves replacement

**Type:** Positive

**Steps:**

1. Log in as a pending Advisory member.
2. Open the incident.
3. Enter approval comments.
4. Approve the request.

**Expected:**

- The member decision is recorded.
- When all required decisions are approved, overall status becomes Approved.
- Replacement fields unlock only where permitted.
- Requester/group notifications are generated.

### IM-REP-007 Non-approver attempts approval

**Type:** Negative / Security

**Steps:**

1. Open a pending approval as an unrelated user or non-member.
2. Attempt to approve or reject.

**Expected:**

- Approval controls are unavailable or save is rejected.
- Approval status and audit trail remain unchanged.

### IM-REP-008 Reject replacement approval

**Type:** Negative / Business rule

**Steps:**

1. Log in as an authorized Advisory member.
2. Reject the approval with a reason.
3. Reopen the incident as the requester.

**Expected:**

- Rejection reason is stored.
- Overall approval reflects rejection/decision state.
- Replacement cannot be completed using the rejected request.
- Requester receives the configured notification.

### IM-REP-009 Approved MRLS spare selection

**Type:** Positive

**Preconditions:** Replacement approval is Approved and a compatible MRLS spare exists for customer/contract/component.

**Steps:**

1. Open the approved replacement request.
2. Select an available MRLS component for each replacement part.
3. Save the incident.

**Expected:**

- Only compatible, available MRLS components are listed.
- Each replacement part has a new serial number.
- Component lifecycle replacement is executed.
- Product Master material serial is updated.
- Movement, repair, and replacement audit records are created.

### IM-REP-010 No MRLS spare available

**Type:** Negative

**Steps:**

1. Use an approved replacement request for a component with no compatible MRLS spare.
2. Attempt to complete the replacement.

**Expected:**

- No spare is selectable.
- Save/replacement is blocked with a clear message.
- No product, lifecycle, or incident record is partially updated.

### IM-REP-011 Duplicate replacement serial numbers

**Type:** Negative

**Steps:**

1. Add two replacement parts.
2. Enter the same new serial number for both.
3. Save.

**Expected:**

- Save is blocked.
- The duplicate serial is identified.
- No replacement transaction is sent.

### IM-REP-012 Existing serial-number collision

**Type:** Negative

**Steps:**

1. Enter a new replacement serial already assigned to another product/component.
2. Save the approved replacement.

**Expected:**

- Save is rejected with a collision message.
- The existing component remains unchanged.
- No replacement transaction or follow-up incident is created.

### IM-REP-013 Replacement serial required for every approved part

**Type:** Negative

**Steps:**

1. Approve a request with multiple parts.
2. Select a new serial for only one part.
3. Attempt to save.

**Expected:**

- Save is blocked.
- Every missing replacement serial is identified or the request is clearly marked incomplete.

### IM-REP-014 Create MRLS factory follow-up incident

**Type:** Positive

**Preconditions:** Approved MRLS replacement is complete and the incident moves to Post Repair Acceptance; no factory child exists.

**Steps:**

1. Complete the approved MRLS replacement.
2. Move the incident to customer acceptance.
3. Inspect the incident list and parent audit.

**Expected:**

- One factory follow-up child incident is created.
- Child is assigned to Advisory Group and references the parent incident.
- Parent stores the child incident ID.
- Follow-up notification is generated where configured.

### IM-REP-015 Do not create duplicate factory child incident

**Type:** Negative

**Steps:**

1. Reopen/save the same parent incident at customer acceptance.
2. Repeat the transition.

**Expected:**

- No second factory child incident is created.
- Existing parent-child relationship remains intact.

## 8. Post-Repair Quality and Customer Acceptance

### IM-QC-001 Record customer feedback

**Type:** Positive

**Steps:**

1. Open a repair-at-site incident at Post Repair Acceptance by Customer.
2. Add one feedback item.
3. Enter customer feedback, quality-check status, and remarks.
4. Add a second feedback item and complete it.
5. Save.

**Expected:**

- Each feedback item is stored separately.
- Quality status and remarks persist.
- Audit history presents structured feedback values.

### IM-QC-002 Satisfied acceptance requires feedback

**Type:** Negative

**Steps:**

1. Open a customer-acceptance incident.
2. Leave feedback empty.
3. Select Issue Rectified - Satisfied.

**Expected:**

- Satisfied cannot be selected or saved.
- A message instructs the user to record customer feedback first.
- Status remains at customer acceptance.

### IM-QC-003 Confirm satisfied acceptance

**Type:** Positive

**Steps:**

1. Record at least one customer feedback item.
2. Mark quality checks appropriately.
3. Select Issue Rectified - Satisfied.
4. Save/transition.

**Expected:**

- Satisfied decision persists.
- The workflow moves to the configured next stage, normally Closed.
- Acceptance audit history records feedback and decision.

### IM-QC-004 Return incident when not satisfied

**Type:** Positive / Business rule

**Steps:**

1. Open a customer-acceptance incident.
2. Select Not Satisfied.
3. Confirm the displayed previous assignment/status.
4. Send back to previous stage.

**Expected:**

- Return target shows the prior repair owner/stage.
- Incident returns to the correct status, group, and assignee.
- Dissatisfaction reason/feedback is retained.
- Corrective-action notification/email is generated.

### IM-QC-005 Not satisfied without a return target

**Type:** Negative

**Steps:**

1. Use an incident with missing or invalid previous routing data.
2. Select Not Satisfied.
3. Attempt to send back.

**Expected:**

- Return action is disabled or rejected.
- No invalid assignment is created.
- The incident remains available for administrator correction.

### IM-QC-006 Restrict acceptance decision to authorized user

**Type:** Negative / Security

**Steps:**

1. Open customer acceptance as an unrelated user.
2. Attempt to add feedback, select an outcome, or return the incident.

**Expected:**

- Controls are disabled or save is rejected.
- No acceptance decision or feedback change is persisted.

## 9. Attachments and Camera Capture

### IM-ATT-001 Add supported attachment

**Type:** Positive

**Steps:**

1. Open New Incident or an editable incident.
2. Add a supported image/document file.
3. Save.
4. Refresh and reopen.

**Expected:**

- File name, type, and size are shown.
- Images display a preview when content is available.
- Download/open action works for stored content.
- Attachment persists after refresh and appears in the audit change when modified.

### IM-ATT-002 Add multiple attachments

**Type:** Positive

**Steps:**

1. Select multiple files in one operation.
2. Add another file in a second operation.
3. Save.

**Expected:**

- All files are retained once each.
- Duplicate file names do not overwrite unrelated attachments.
- Removal of one file does not remove others.

### IM-ATT-003 Remove attachment before save

**Type:** Positive

**Steps:**

1. Add two attachments.
2. Remove one.
3. Save.
4. Reopen.

**Expected:**

- Only the remaining attachment persists.
- Audit shows the attachment collection change when applicable.

### IM-ATT-004 Camera capture success

**Type:** Positive

**Preconditions:** Browser/device grants camera access.

**Steps:**

1. Select Capture image.
2. Grant camera permission.
3. Capture an image.
4. Save the incident.

**Expected:**

- Camera preview opens.
- Captured image becomes an attachment with a generated filename.
- Camera stream is stopped when the dialog closes.
- Image persists with the incident.

### IM-ATT-005 Camera unavailable fallback

**Type:** Negative / Recovery

**Steps:**

1. Deny camera permission or use a browser without camera support.
2. Select Capture image.
3. Choose an image through the fallback picker.

**Expected:**

- A clear camera-unavailable message appears.
- Image picker fallback is available.
- Selected image is attached normally.

### IM-ATT-006 Attachment read-only behavior

**Type:** Negative / Security

**Steps:**

1. Open an incident without edit permission.
2. Attempt to add, remove, or replace attachments.

**Expected:**

- Attachment controls are disabled or save is rejected.
- Existing attachments remain unchanged.

## 10. Notifications, Audit, and Export

### IM-NOT-001 Incident creation notification

**Type:** Positive

**Steps:**

1. Create a valid incident with a configured registration rule.
2. Inspect recipient notifications and email logs.

**Expected:**

- Intended recipients receive one notification.
- Template fields contain incident number, description, priority, status, assignment group, and link.
- No password, secret, or unrelated record data appears.

### IM-NOT-002 Assignment change notification

**Type:** Positive

**Steps:**

1. Change assignment group or assignee.
2. Save.
3. Inspect notifications and email logs.

**Expected:**

- Assignment recipients receive one notification.
- Old recipients are not incorrectly notified unless configured.
- Delivery key prevents duplicate notifications from one save.

### IM-NOT-003 Approval notification

**Type:** Positive

**Steps:**

1. Submit a pre-dispatch or replacement approval.
2. Inspect Advisory Group notifications and email logs.

**Expected:**

- Active approval members receive notifications.
- Approval type, requested group, requester, and incident link are correct.

### IM-NOT-004 Notification failure does not corrupt incident

**Type:** Negative / Resilience

**Steps:**

1. Simulate email service failure after a valid incident save.
2. Create or update the incident.
3. Reopen the incident.

**Expected:**

- Core incident save succeeds if notification delivery is asynchronous.
- Failure is logged without exposing secrets.
- The user sees an appropriate warning if the product supports one.
- Retrying notification does not duplicate the incident.

### IM-AUD-001 Audit changed fields

**Type:** Positive

**Steps:**

1. Change priority, assignment, status, resolution notes, attachments, and work notes in separate saves.
2. Open the audit/history view.

**Expected:**

- Each change includes field label, previous value, next value, user, group, and timestamp.
- Complex approval and feedback objects are rendered in readable structured form.
- Attachment changes show names/types rather than file contents.

### IM-AUD-002 No audit entry for no-op save

**Type:** Negative / Data quality

**Steps:**

1. Open an incident.
2. Save without changing fields or adding a note.

**Expected:**

- No meaningless duplicate change entry is added.
- Existing history remains unchanged.

### IM-EXP-001 Export incident PDF

**Type:** Positive

**Steps:**

1. Open an incident as a permitted Administrator, CSM member, or Advisory member.
2. Select the PDF export action.
3. Open the generated PDF.

**Expected:**

- PDF includes incident details, assignment, resolution, replacement data, attachments, and audit history where present.
- Filename is derived safely from the incident number.
- Long text does not overlap or corrupt the document.

### IM-EXP-002 Restrict PDF export

**Type:** Negative / Security

**Steps:**

1. Open an incident as an unrelated user.
2. Attempt PDF export.

**Expected:**

- Export is unavailable or denied.
- No file is generated.

## 11. Persistence, Refresh, and Concurrency

### IM-DATA-001 Incident survives refresh

**Type:** Positive

**Steps:**

1. Create or update an incident.
2. Refresh the browser.
3. Search for the incident.

**Expected:**

- Incident and all saved fields persist.
- Attachments, audit history, assignments, and workflow state remain available.

### IM-DATA-002 Incident survives backend restart

**Type:** Positive / Recovery

**Steps:**

1. Save an incident.
2. Restart the API service.
3. Reload the application.
4. Reopen the incident.

**Expected:**

- Persisted incident data remains unchanged.
- The application reports a clear error only for unavailable operations.

### IM-DATA-003 Concurrent edits

**Type:** Negative / Concurrency

**Steps:**

1. Open the same incident in two browser sessions.
2. Change priority in Session A and save.
3. Change assignment in Session B using the stale form and save.
4. Inspect the final record and audit history.

**Expected:**

- The product's last-write or conflict policy is consistent.
- No unrelated fields are silently lost if field-level merge is supported.
- Audit history identifies both updates.

### IM-DATA-004 Partial failure during replacement

**Type:** Negative / Transactional integrity

**Steps:**

1. Prepare an approved multi-part MRLS replacement.
2. Force one component-lifecycle replacement call to fail.
3. Save the incident.
4. Inspect all affected records.

**Expected:**

- The user receives a replacement failure message.
- The incident does not claim all parts were replaced.
- Product serials, lifecycle movements, repair records, and child incidents remain consistent.
- Any required compensation/rollback behavior is executed or clearly reported.

### IM-DATA-005 Malformed legacy incident

**Type:** Negative / Compatibility

**Steps:**

1. Load an incident missing optional fields, using legacy `stage` instead of `status`, or containing an old attachment format.
2. Open and filter the incident.
3. Attempt a permitted edit.

**Expected:**

- The incident can be displayed without a page crash.
- Status falls back to stage where supported.
- Missing optional fields show safe placeholders.
- Saving does not erase unrelated legacy data.

## 12. Cross-Browser and Accessibility Checks

### IM-ACC-001 Keyboard-only registration

**Type:** Positive

**Steps:**

1. Navigate the incident list and registration form using keyboard only.
2. Use Tab, Shift+Tab, Enter, Space, and Escape.
3. Submit the form.

**Expected:**

- Focus order is logical.
- All controls are reachable and operable.
- Required errors are visible and associated with fields.
- Dialogs trap focus appropriately and return focus on close.

### IM-ACC-002 Screen-reader labels

**Type:** Positive

**Steps:**

1. Use a screen reader on the list, form, attachment controls, workflow, and approval panels.
2. Inspect buttons, comboboxes, checkboxes, status messages, and dialogs.

**Expected:**

- Controls have meaningful accessible names.
- Status/error messages are announced.
- Dynamic listbox suggestions identify option names and types.

### IM-ACC-003 Responsive incident form

**Type:** Positive / Layout

**Steps:**

1. Test desktop, tablet, and mobile viewport sizes.
2. Open registration, detail, approval, camera, and attachment views.
3. Rotate or resize the viewport.

**Expected:**

- No controls overlap or become unreachable.
- Tables scroll or reflow without losing actions.
- Long incident numbers, descriptions, filenames, and group names remain readable.

## 13. Exit Criteria

The Incident Management release is ready for acceptance when:

- All IM-REG, IM-EDIT, IM-WF, IM-REP, IM-QC, IM-ATT, IM-NOT, IM-AUD, IM-EXP, and IM-DATA critical cases pass.
- No unauthorized user can create, edit, approve, export, or change incident assignments outside their scope.
- No incident transition can bypass required fields, work notes, approval, feedback, or replacement validation.
- Every create/update/transition failure leaves the database and UI in a consistent state.
- Notifications and audit history contain correct, non-sensitive information.
- The suite passes on the supported desktop browser and the client deployment browser.
- Any failed case has a documented defect ID, severity, evidence, and retest result.

## 14. Defect Severity Guidance

- **Critical:** Data loss, unauthorized access, incorrect component replacement, incorrect closure, or inability to create/open all incidents.
- **High:** Invalid workflow transition, approval bypass, incorrect assignment, missing audit record, duplicate incident, or corrupted persistence.
- **Medium:** Incorrect filter/export/notification behavior, missing validation message, or recoverable attachment/camera issue.
- **Low:** Visual alignment, copy, sorting tie-breaker, or non-blocking accessibility issue.
