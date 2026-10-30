-- CreateTable
CREATE TABLE `fitness_assessment_score` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `fitnessSkillId` INTEGER NOT NULL,
    `eventId` INTEGER NOT NULL,
    `tenantId` INTEGER NOT NULL,
    `score` INTEGER NOT NULL,
    `eventdate` DATE NOT NULL,
    `remark` VARCHAR(200) NULL,

    INDEX `fitness_assessment_score_studentId_idx`(`studentId`),
    INDEX `fitness_assessment_score_fitnessSkillId_idx`(`fitnessSkillId`),
    INDEX `fitness_assessment_score_eventId_idx`(`eventId`),
    INDEX `fitness_assessment_score_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `fitness_assessment_score` ADD CONSTRAINT `fitness_assessment_score_fitnessSkillId_fkey` FOREIGN KEY (`fitnessSkillId`) REFERENCES `fitness_skill`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
