-- Link fitness_result rows to events/tenant for fitness assessment (safe if columns already exist: run manually and skip errors)
ALTER TABLE `fitness_result` ADD COLUMN `event_id` INTEGER NULL;
ALTER TABLE `fitness_result` ADD COLUMN `tenant_id` INTEGER NULL;

CREATE INDEX `fitness_result_event_id_idx` ON `fitness_result`(`event_id`);
CREATE INDEX `fitness_result_tenant_id_idx` ON `fitness_result`(`tenant_id`);
