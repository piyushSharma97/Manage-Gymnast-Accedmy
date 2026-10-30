-- Fitness schema update: categories, skills (by category + unit), grading criteria, results
-- Run this manually if your DB does not yet have these tables/changes.
-- If fitness_assessment_score exists and references fitness_skill, uncomment the FK drop/readd steps below.

-- 1. Create fitness_categories
CREATE TABLE IF NOT EXISTS `fitness_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(500) NOT NULL,
    `createdAt` DATETIME NULL,
    `updatedAt` DATETIME NULL,
    `createdBy` VARCHAR(151) NULL,
    `updatedBy` VARCHAR(151) NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Alter fitness_skill to new structure (only if you are migrating from old schema)
-- If fitness_assessment_score exists, drop its FK first:
-- ALTER TABLE `fitness_assessment_score` DROP FOREIGN KEY `fitness_assessment_score_fitnessSkillId_fkey`;

-- Add new columns to fitness_skill (run only if migrating from old schema; skip if columns already exist)
-- ALTER TABLE `fitness_skill` ADD COLUMN `fitness_categoryid` INTEGER NULL;
-- ALTER TABLE `fitness_skill` ADD COLUMN `unit_of_measurement` VARCHAR(190) NULL;

-- Optional: drop old columns (run after backfilling fitness_categoryid and unit_of_measurement)
-- ALTER TABLE `fitness_skill` DROP COLUMN `tenantId`;
-- ALTER TABLE `fitness_skill` DROP COLUMN `level`;
-- ALTER TABLE `fitness_skill` DROP COLUMN `description`;
-- ALTER TABLE `fitness_skill` DROP COLUMN `orderSequence`;
-- ALTER TABLE `fitness_skill` DROP COLUMN `isActive`;
-- ALTER TABLE `fitness_skill` MODIFY COLUMN `fitness_categoryid` INTEGER NOT NULL;
-- ALTER TABLE `fitness_skill` MODIFY COLUMN `unit_of_measurement` VARCHAR(190) NOT NULL;

-- Re-add FK for fitness_assessment_score if you dropped it:
-- ALTER TABLE `fitness_assessment_score` ADD CONSTRAINT `fitness_assessment_score_fitnessSkillId_fkey` FOREIGN KEY (`fitnessSkillId`) REFERENCES `fitness_skill`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Create fitness_grading_criteria
CREATE TABLE IF NOT EXISTS `fitness_grading_criteria` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fitness_skill_id` INTEGER NOT NULL,
    `level` VARCHAR(200) NOT NULL,
    `description` VARCHAR(300) NULL,
    `targetvalue` VARCHAR(200) NULL,
    `createdAt` DATETIME NULL,
    `updatedAt` DATETIME NULL,
    `createdBy` VARCHAR(200) NULL,
    `updatedBy` VARCHAR(200) NULL,
    INDEX `fitness_grading_criteria_fitness_skill_id_idx`(`fitness_skill_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `fitness_grading_criteria` ADD CONSTRAINT `fitness_grading_criteria_fitness_skill_id_fkey` FOREIGN KEY (`fitness_skill_id`) REFERENCES `fitness_skill`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Create fitness_result (gymnast_id as BIGINT to match student.id)
CREATE TABLE IF NOT EXISTS `fitness_result` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `gymnast_id` BIGINT NOT NULL,
    `level` VARCHAR(200) NOT NULL,
    `fitness_skill_id` INTEGER NOT NULL,
    `fitness_categoryid` INTEGER NOT NULL,
    `achieved_value` VARCHAR(200) NOT NULL,
    `remarks` VARCHAR(200) NULL,
    `date` DATETIME NOT NULL,
    `createdAt` DATETIME NULL,
    `updatedAt` DATETIME NULL,
    `createdBy` VARCHAR(200) NULL,
    `updatedBy` VARCHAR(200) NULL,
    INDEX `fitness_result_gymnast_id_idx`(`gymnast_id`),
    INDEX `fitness_result_fitness_skill_id_idx`(`fitness_skill_id`),
    INDEX `fitness_result_fitness_categoryid_idx`(`fitness_categoryid`),
    INDEX `fitness_result_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `fitness_result` ADD CONSTRAINT `fitness_result_gymnast_id_fkey` FOREIGN KEY (`gymnast_id`) REFERENCES `student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fitness_result` ADD CONSTRAINT `fitness_result_fitness_skill_id_fkey` FOREIGN KEY (`fitness_skill_id`) REFERENCES `fitness_skill`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `fitness_result` ADD CONSTRAINT `fitness_result_fitness_categoryid_fkey` FOREIGN KEY (`fitness_categoryid`) REFERENCES `fitness_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
