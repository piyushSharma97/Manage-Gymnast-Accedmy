-- CreateTable
CREATE TABLE `employeeskilllevel` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `skillLevelId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NOT NULL,

    INDEX `employeeskilllevel_employeeId_idx`(`employeeId`),
    INDEX `employeeskilllevel_skillLevelId_idx`(`skillLevelId`),
    UNIQUE INDEX `employeeskilllevel_employeeId_skillLevelId_key`(`employeeId`, `skillLevelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employeeskilllevel` ADD CONSTRAINT `employeeskilllevel_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employeeskilllevel` ADD CONSTRAINT `employeeskilllevel_skillLevelId_fkey` FOREIGN KEY (`skillLevelId`) REFERENCES `skilllevel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
