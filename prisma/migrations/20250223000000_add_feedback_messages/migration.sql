-- CreateTable
CREATE TABLE `feedback_message` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `guardianId` BIGINT NOT NULL,
    `senderUserId` VARCHAR(36) NOT NULL,
    `senderRole` VARCHAR(20) NOT NULL,
    `parentMessageId` BIGINT NULL,
    `subject` VARCHAR(500) NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `feedback_message_tenantId_idx`(`tenantId`),
    INDEX `feedback_message_guardianId_idx`(`guardianId`),
    INDEX `feedback_message_parentMessageId_idx`(`parentMessageId`),
    INDEX `feedback_message_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feedback_notification` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `feedbackMessageId` BIGINT NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `readAt` TIMESTAMP(6) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `feedback_notification_feedbackMessageId_userId_key`(`feedbackMessageId`, `userId`),
    INDEX `feedback_notification_userId_idx`(`userId`),
    INDEX `feedback_notification_feedbackMessageId_idx`(`feedbackMessageId`),
    INDEX `feedback_notification_readAt_idx`(`readAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `feedback_message` ADD CONSTRAINT `feedback_message_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedback_message` ADD CONSTRAINT `feedback_message_guardianId_fkey` FOREIGN KEY (`guardianId`) REFERENCES `guardian`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedback_message` ADD CONSTRAINT `feedback_message_parentMessageId_fkey` FOREIGN KEY (`parentMessageId`) REFERENCES `feedback_message`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedback_notification` ADD CONSTRAINT `feedback_notification_feedbackMessageId_fkey` FOREIGN KEY (`feedbackMessageId`) REFERENCES `feedback_message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
