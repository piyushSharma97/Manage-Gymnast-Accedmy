-- Optional PayU merchant credentials for external event registration
ALTER TABLE `tenant` ADD COLUMN `payuMerchantKey` VARCHAR(255) NULL;
ALTER TABLE `tenant` ADD COLUMN `payuMerchantSalt` VARCHAR(255) NULL;
